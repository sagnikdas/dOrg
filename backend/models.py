"""Pydantic models for API requests and responses."""

from pydantic import BaseModel
from typing import List, Optional, Literal


class TreeNode(BaseModel):
    """Represents a file or folder node in the directory tree."""
    id: str  # unique stable ID (use relative path for now)
    name: str
    type: Literal["file", "folder"]
    relative_path: str
    size: Optional[int] = None  # file size in bytes, None for folders
    children: Optional[List["TreeNode"]] = None  # only for folders


class MoveItem(BaseModel):
    """Represents a single file/folder move operation."""
    from_path: str  # relative path from ROOT
    to_path: str    # relative path from ROOT


class MoveRequest(BaseModel):
    """Request to apply file/folder moves."""
    moves: List[MoveItem]
    dry_run: bool = True


class MoveResultItem(BaseModel):
    """Result of a single move operation."""
    from_path: str
    to_path: str
    status: str  # "dry_ok", "moved", "moved_fallback", "skip", "error"
    reason: Optional[str] = None


class MoveResponse(BaseModel):
    """Response containing results of all move operations."""
    dry_run: bool
    results: List[MoveResultItem]


class UndoResponse(BaseModel):
    """Response from undo operation."""
    success: bool
    message: str
    reversed_moves: List[MoveItem]


class OrganizeRequest(BaseModel):
    """Request to organize files by type."""
    root_path: Optional[str] = None  # Optional override for root path


class OrganizeResponse(BaseModel):
    """Response from organize operation."""
    moves: List[MoveItem]
    organized_tree: TreeNode  # The draft tree structure after organization


class SetRootPathRequest(BaseModel):
    """Request to set the root path."""
    root_path: str


class SetRootPathResponse(BaseModel):
    """Response from set root path operation."""
    success: bool
    root_path: str
    message: str


class VerifyTokenRequest(BaseModel):
    """Request to verify a JWT token."""
    token: str


class VerifyTokenResponse(BaseModel):
    """Response from token verification."""
    valid: bool
    user: Optional[dict] = None


# Update forward references for recursive model
TreeNode.update_forward_refs()

