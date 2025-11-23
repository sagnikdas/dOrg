"""File organization by file type."""

import os
from pathlib import Path
from typing import Dict, List, Optional
from models import TreeNode, MoveItem
from filesystem import scan_tree
from config import get_root_path


def get_file_extension(file_path: str) -> str:
    """Get file extension in lowercase, or 'no-extension' if none."""
    ext = Path(file_path).suffix.lower()
    if ext:
        return ext[1:]  # Remove the dot
    return "no-extension"


def organize_by_file_type(root_path: str = None) -> List[MoveItem]:
    """
    Organize files by their extension.
    Creates folders named after file extensions and moves files into them.
    
    Args:
        root_path: Optional root path (defaults to ROOT_PATH)
        
    Returns:
        List of MoveItem objects representing the moves to be made
    """
    if root_path is None:
        root_path = get_root_path()
    
    # Scan the tree
    tree = scan_tree(root_path)
    
    moves: List[MoveItem] = []
    
    def process_node(node: TreeNode, base_path: str = "."):
        """Recursively process nodes and generate moves."""
        if node.type == "file":
            # Get file extension
            ext = get_file_extension(node.name)
            
            # Create target folder name (e.g., "mp3", "txt", "pdf")
            target_folder = ext
            
            # Target path: base_path/target_folder/filename
            if base_path == ".":
                target_path = f"{target_folder}/{node.name}"
            else:
                target_path = f"{base_path}/{target_folder}/{node.name}"
            
            # Only add move if the file is not already in the correct folder
            current_dir = os.path.dirname(node.relative_path) if node.relative_path != node.name else "."
            target_dir = os.path.dirname(target_path)
            
            if current_dir != target_dir:
                moves.append(MoveItem(
                    from_path=node.relative_path,
                    to_path=target_path
                ))
        elif node.type == "folder" and node.children:
            # Process children, but skip folders that are already extension folders
            # (to avoid reorganizing already organized files)
            current_ext = get_file_extension(node.name)
            is_extension_folder = (
                node.name == current_ext and 
                node.name not in ["no-extension"] and
                len(node.name) <= 10  # Extension folders are typically short
            )
            
            if not is_extension_folder:
                for child in node.children:
                    process_node(child, node.relative_path)
    
    # Process all nodes except root
    if tree.children:
        for child in tree.children:
            process_node(child)
    
    return moves


def deep_clone_tree(node: TreeNode) -> TreeNode:
    """Deep clone a TreeNode."""
    return TreeNode(
        id=node.id,
        name=node.name,
        type=node.type,
        relative_path=node.relative_path,
        size=node.size,
        children=[deep_clone_tree(child) for child in node.children] if node.children else None
    )


def find_node_by_path(tree: TreeNode, path: str) -> Optional[TreeNode]:
    """Find a node by its relative path."""
    if tree.relative_path == path:
        return tree
    
    if tree.children:
        for child in tree.children:
            found = find_node_by_path(child, path)
            if found:
                return found
    
    return None

