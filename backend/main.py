"""FastAPI backend for file reorganization operations."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

from models import MoveRequest, MoveResponse, TreeNode, MoveItem, UndoResponse
from filesystem import scan_tree, apply_moves
from config import ROOT_PATH
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
    return {"status": "ok", "root_path": ROOT_PATH}


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
        logger.info(f"Scanning tree at {ROOT_PATH}")
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
        
        # Apply the reversed moves
        results = apply_moves(reversed_moves, dry_run=False)
        
        # Check if all reversals were successful
        all_successful = all(
            r.status in ("moved", "moved_fallback")
            for r in results
        )
        
        if not all_successful:
            # If undo failed, put the moves back in history
            move_history.append(last_moves)
            failed_count = sum(1 for r in results if r.status not in ("moved", "moved_fallback"))
            raise HTTPException(
                status_code=500,
                detail=f"Failed to undo {failed_count} move(s). Some files may have been moved."
            )
        
        logger.info(f"Successfully undone {len(reversed_moves)} moves")
        
        return UndoResponse(
            success=True,
            message=f"Successfully undone {len(reversed_moves)} move(s)",
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

