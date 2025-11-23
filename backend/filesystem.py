"""Filesystem operations for scanning and moving files/folders."""

import os
import shutil
from pathlib import Path
from typing import Optional
import logging

from models import TreeNode, MoveItem, MoveResultItem
from config import get_root_path, get_absolute_path, validate_path

logger = logging.getLogger(__name__)


def scan_tree(root_path: Optional[str] = None) -> TreeNode:
    """
    Recursively scan directory tree and return TreeNode representation.
    
    Uses os.scandir for efficient iteration. Sorts entries by name for stable output.
    Sets size for files, None for folders. All paths are relative to ROOT_PATH.
    
    Args:
        root_path: Optional override for root path (defaults to ROOT_PATH)
        
    Returns:
        TreeNode representing the root directory
        
    Raises:
        FileNotFoundError: If root_path doesn't exist
        PermissionError: If access is denied
    """
    if root_path is None:
        root_path = get_root_path()
    
    root_path = os.path.abspath(root_path)
    
    if not os.path.exists(root_path):
        raise FileNotFoundError(f"Root path does not exist: {root_path}")
    
    if not os.path.isdir(root_path):
        raise ValueError(f"Root path is not a directory: {root_path}")
    
    def _scan_recursive(current_path: str, relative_path: str) -> Optional[TreeNode]:
        """
        Recursively scan a directory.
        
        Args:
            current_path: Absolute path to scan
            relative_path: Relative path from ROOT_PATH
            
        Returns:
            TreeNode or None if path doesn't exist or is a symlink
        """
        try:
            # Skip symlinks
            if os.path.islink(current_path):
                logger.warning(f"Skipping symlink: {current_path}")
                return None
            
            stat = os.stat(current_path)
            name = os.path.basename(current_path)
            
            if os.path.isdir(current_path):
                children = []
                try:
                    # Use scandir for efficient iteration
                    entries = sorted(os.scandir(current_path), key=lambda e: e.name)
                    for entry in entries:
                        child_relative = os.path.join(relative_path, entry.name).replace("\\", "/")
                        child_node = _scan_recursive(entry.path, child_relative)
                        if child_node:
                            children.append(child_node)
                except PermissionError as e:
                    logger.warning(f"Permission denied scanning {current_path}: {e}")
                
                return TreeNode(
                    id=relative_path,
                    name=name,
                    type="folder",
                    relative_path=relative_path,
                    size=None,
                    children=children if children else None
                )
            else:
                # It's a file
                return TreeNode(
                    id=relative_path,
                    name=name,
                    type="file",
                    relative_path=relative_path,
                    size=stat.st_size
                )
        except (OSError, PermissionError) as e:
            logger.warning(f"Error scanning {current_path}: {e}")
            return None
    
    root_node = _scan_recursive(root_path, ".")
    if root_node is None:
        raise RuntimeError(f"Failed to scan root path: {root_path}")
    
    # Ensure root node has proper name (basename of root path)
    root_name = os.path.basename(root_path) or root_path
    root_node.name = root_name
    
    return root_node


def apply_moves(moves: list[MoveItem], dry_run: bool = True) -> list[MoveResultItem]:
    """
    Apply file/folder move operations with safety checks.
    
    Moves are sorted by depth (deepest first) to avoid conflicts when moving directories.
    Uses os.rename for same-filesystem moves, falls back to shutil.move if needed.
    
    Args:
        moves: List of MoveItem objects
        dry_run: If True, only simulate moves without actually moving files
        
    Returns:
        List of MoveResultItem objects
    """
    
    # Validate all paths first
    for move in moves:
        if not validate_path(move.from_path) or not validate_path(move.to_path):
            raise ValueError(f"Invalid path in move: {move.from_path} -> {move.to_path}")
    
    # Sort by depth (deepest first) to avoid conflicts
    def get_depth(path: str) -> int:
        return len([p for p in path.split("/") if p])
    
    sorted_moves = sorted(moves, key=lambda m: get_depth(m.from_path), reverse=True)
    
    results = []
    
    for move in sorted_moves:
        try:
            from_abs = get_absolute_path(move.from_path)
            to_abs = get_absolute_path(move.to_path)
            
            # Check source exists
            if not os.path.exists(from_abs):
                results.append(MoveResultItem(
                    from_path=move.from_path,
                    to_path=move.to_path,
                    status="error",
                    reason="source_not_found"
                ))
                continue
            
            # Check if destination already exists
            if os.path.exists(to_abs):
                results.append(MoveResultItem(
                    from_path=move.from_path,
                    to_path=move.to_path,
                    status="skip",
                    reason="destination_exists"
                ))
                continue
            
            if dry_run:
                # Just validate and simulate
                results.append(MoveResultItem(
                    from_path=move.from_path,
                    to_path=move.to_path,
                    status="dry_ok",
                    reason=None
                ))
                logger.info(f"DRY RUN: Would move {move.from_path} -> {move.to_path}")
            else:
                # Ensure destination directory exists
                dest_dir = os.path.dirname(to_abs)
                os.makedirs(dest_dir, exist_ok=True)
                
                # Try os.rename first (fast, metadata-only on same filesystem)
                try:
                    os.rename(from_abs, to_abs)
                    results.append(MoveResultItem(
                        from_path=move.from_path,
                        to_path=move.to_path,
                        status="moved",
                        reason=None
                    ))
                    logger.info(f"Moved {move.from_path} -> {move.to_path} (os.rename)")
                except OSError:
                    # Fall back to shutil.move (handles cross-filesystem moves)
                    try:
                        shutil.move(from_abs, to_abs)
                        results.append(MoveResultItem(
                            from_path=move.from_path,
                            to_path=move.to_path,
                            status="moved_fallback",
                            reason="used_shutil_move"
                        ))
                        logger.info(f"Moved {move.from_path} -> {move.to_path} (shutil.move)")
                    except Exception as e:
                        results.append(MoveResultItem(
                            from_path=move.from_path,
                            to_path=move.to_path,
                            status="error",
                            reason=str(e)
                        ))
                        logger.error(f"Error moving {move.from_path} -> {move.to_path}: {e}")
        
        except Exception as e:
            results.append(MoveResultItem(
                from_path=move.from_path,
                to_path=move.to_path,
                status="error",
                reason=str(e)
            ))
            logger.error(f"Error processing move {move.from_path} -> {move.to_path}: {e}")
    
    return results

