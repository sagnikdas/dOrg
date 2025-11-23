"""FastAPI backend for file reorganization operations."""

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
import logging

from models import (
    MoveRequest, MoveResponse, TreeNode, MoveItem, UndoResponse,
    OrganizeRequest, OrganizeResponse, SetRootPathRequest, SetRootPathResponse,
    VerifyTokenRequest, VerifyTokenResponse
)
from filesystem import scan_tree, apply_moves, remove_empty_folders
from config import set_root_path, get_root_path
from organize import organize_by_file_type
from auth import oauth, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES, GOOGLE_OAUTH_ENABLED
from datetime import timedelta
from typing import List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="File Reorganization API", version="1.0.0")

# Simple in-memory history for undo (in production, use a database)
move_history: List[List[MoveItem]] = []

# Add session middleware for OAuth
app.add_middleware(SessionMiddleware, secret_key="your-secret-key-change-in-production")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "root_path": get_root_path()}


# Authentication endpoints
@app.get("/auth/google")
async def google_login(request: Request):
    """Initiate Google OAuth login."""
    if not GOOGLE_OAUTH_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file."
        )
    redirect_uri = request.url_for('google_callback')
    # Force account selection to allow users to choose different email
    return await oauth.google.authorize_redirect(
        request, 
        redirect_uri,
        prompt='select_account'  # This ensures account selection screen is shown
    )


@app.get("/auth/callback", name="google_callback")
async def google_callback(request: Request):
    """Handle Google OAuth callback."""
    if not GOOGLE_OAUTH_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured."
        )
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        # Create JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user_info.get("email", user_info.get("sub")),
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
            },
            expires_delta=access_token_expires
        )
        
        # In Electron, redirect to a custom protocol or return token
        # For web, redirect to frontend with token
        frontend_url = f"http://localhost:5173/auth/callback?token={access_token}"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")


@app.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user information."""
    return {
        "email": current_user.get("email"),
        "name": current_user.get("name"),
        "picture": current_user.get("picture"),
    }


@app.post("/auth/verify", response_model=VerifyTokenResponse)
async def verify_token(request: VerifyTokenRequest):
    """Verify a JWT token and return user info."""
    from auth import SECRET_KEY, ALGORITHM
    from jose import jwt, JWTError
    
    try:
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        return VerifyTokenResponse(
            valid=True,
            user={
                "email": payload.get("email"),
                "name": payload.get("name"),
                "picture": payload.get("picture"),
            }
        )
    except JWTError:
        return VerifyTokenResponse(valid=False, user=None)


@app.get("/tree", response_model=TreeNode)
async def get_tree():
    """
    Get the current directory tree structure under ROOT_PATH.
    
    Returns:
        TreeNode representing the entire tree
        
    Raises:
        HTTPException: If scanning fails
    """
    try:
        root_path = get_root_path()
        logger.info(f"Scanning tree at {root_path}")
        tree = scan_tree()
        return tree
    except FileNotFoundError as e:
        logger.error(f"Root path not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        logger.error(f"Permission denied: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error scanning tree: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/apply-moves", response_model=MoveResponse)
async def apply_file_moves(request: MoveRequest):
    """
    Apply file/folder move operations.
    
    Validates all paths, performs moves sorted by depth (deepest first),
    and returns results for each move operation.
    
    Args:
        request: MoveRequest containing list of moves and dry_run flag
        
    Returns:
        MoveResponse with results for each move
        
    Raises:
        HTTPException: If validation fails
    """
    try:
        logger.info(f"Applying {len(request.moves)} moves (dry_run={request.dry_run})")
        results = apply_moves(request.moves, dry_run=request.dry_run)
        
        # Store successful moves in history for undo (only if not dry_run and successful)
        if not request.dry_run:
            successful_moves = [
                MoveItem(from_path=r.from_path, to_path=r.to_path)
                for r in results
                if r.status in ("moved", "moved_fallback")
            ]
            if successful_moves:
                # Store a copy of the moves for undo
                move_history.append([MoveItem(from_path=m.from_path, to_path=m.to_path) for m in successful_moves])
                logger.info(f"Stored {len(successful_moves)} moves in history for undo")
        
        return MoveResponse(dry_run=request.dry_run, results=results)
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error applying moves: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/undo", response_model=UndoResponse)
async def undo_last_moves():
    """
    Undo the last set of file/folder moves by reversing them.
    
    Returns:
        UndoResponse with success status and reversed moves
        
    Raises:
        HTTPException: If no moves to undo or undo fails
    """
    try:
        if not move_history:
            raise HTTPException(status_code=404, detail="No moves to undo")
        
        # Get the last set of moves
        last_moves = move_history.pop()
        
        # Reverse the moves (swap from_path and to_path)
        reversed_moves = [
            MoveItem(from_path=m.to_path, to_path=m.from_path)
            for m in last_moves
        ]
        
        logger.info(f"Undoing {len(reversed_moves)} moves")
        logger.debug(f"Reversed moves: {[(m.from_path, m.to_path) for m in reversed_moves[:5]]}")
        
        # Apply the reversed moves
        results = apply_moves(reversed_moves, dry_run=False)
        logger.debug(f"Undo results: {[(r.status, r.reason) for r in results[:5]]}")
        
        # Count successful and failed moves
        successful = [r for r in results if r.status in ("moved", "moved_fallback")]
        skipped = [r for r in results if r.status == "skip"]
        failed = [r for r in results if r.status == "error"]
        
        # Log details for debugging
        if failed:
            for f in failed:
                logger.warning(f"Failed to undo move {f.from_path} -> {f.to_path}: {f.reason}")
        if skipped:
            for s in skipped:
                logger.info(f"Skipped undo move {s.from_path} -> {s.to_path}: {s.reason}")
        
        # If there are actual errors (not just skips), that's a problem
        if failed:
            # If undo failed, put the moves back in history
            move_history.append(last_moves)
            error_details = "; ".join([f"{f.from_path} -> {f.to_path}: {f.reason}" for f in failed[:3]])
            if len(failed) > 3:
                error_details += f" (and {len(failed) - 3} more)"
            raise HTTPException(
                status_code=500,
                detail=f"Failed to undo {len(failed)} move(s). {error_details}"
            )
        
        # If some were skipped (destination exists), that's okay - they're already in the right place
        # Log a warning but don't fail
        if skipped:
            logger.warning(f"{len(skipped)} move(s) were skipped during undo (destination already exists)")
        
        # Clean up empty folders that were created during organization
        # Extract folder paths from the original moves (these are the folders that were created)
        folder_paths_to_check = set()
        for move in last_moves:
            # Extract the folder path from the to_path (where files were moved to)
            # e.g., "mp3/file.txt" -> "mp3"
            if '/' in move.to_path:
                folder_path = move.to_path.rsplit('/', 1)[0]
                if folder_path:  # Don't add empty string
                    folder_paths_to_check.add(folder_path)
        
        # Remove empty folders (deepest first)
        removed_folders = []
        if folder_paths_to_check:
            try:
                removed_folders = remove_empty_folders(folder_paths=list(folder_paths_to_check))
                if removed_folders:
                    logger.info(f"Removed {len(removed_folders)} empty folder(s) after undo")
            except Exception as e:
                # Don't fail undo if folder cleanup fails
                logger.warning(f"Error cleaning up empty folders: {e}")
        
        # Build success message
        success_msg = f"Successfully undone {len(successful)} move(s)"
        if skipped:
            success_msg += f" ({len(skipped)} were already in place)"
        if removed_folders:
            success_msg += f" and removed {len(removed_folders)} empty folder(s)"
        
        logger.info(success_msg)
        
        return UndoResponse(
            success=True,
            message=success_msg,
            reversed_moves=reversed_moves
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error undoing moves: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/undo-status")
async def get_undo_status():
    """Check if there are moves available to undo."""
    return {
        "can_undo": len(move_history) > 0,
        "pending_move_sets": len(move_history)
    }


@app.post("/set-root-path", response_model=SetRootPathResponse)
async def set_root_directory(request: SetRootPathRequest):
    """
    Set the root directory for file operations.
    
    Args:
        request: SetRootPathRequest containing the root path
        
    Returns:
        SetRootPathResponse with success status
    """
    try:
        if set_root_path(request.root_path):
            return SetRootPathResponse(
                success=True,
                root_path=get_root_path(),
                message=f"Root path set to {request.root_path}"
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid path")
    except Exception as e:
        logger.error(f"Error setting root path: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/organize-by-type", response_model=OrganizeResponse)
async def organize_files_by_type(request: OrganizeRequest):
    """
    Organize files by their extension type.
    Creates folders named after file extensions and generates moves.
    
    Args:
        request: OrganizeRequest with optional root_path
        
    Returns:
        OrganizeResponse with moves and organized tree structure
    """
    try:
        # Get the root path (use request path or default)
        root_path = request.root_path if request.root_path else get_root_path()
        
        logger.info(f"Organizing files by type in {root_path}")
        
        # Generate moves for organizing by file type
        moves = organize_by_file_type(root_path)
        
        # Get the original tree
        original_tree = scan_tree(root_path)
        
        # For now, we'll return the moves and original tree
        # The frontend will compute the draft tree based on moves
        return OrganizeResponse(
            moves=moves,
            organized_tree=original_tree  # Frontend will compute draft tree
        )
    except FileNotFoundError as e:
        logger.error(f"Root path not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        logger.error(f"Permission denied: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error organizing files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

