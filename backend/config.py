"""Configuration for the file reorganization backend."""

import os
from pathlib import Path

# Root directory of the HDD volume to manage
# Can be set via environment variable: export HDD_ROOT_PATH=/path/to/hdd
ROOT_PATH = os.getenv("HDD_ROOT_PATH", "/Users/sagnikdas/Downloads")

# Ensure ROOT_PATH is absolute
ROOT_PATH = os.path.abspath(ROOT_PATH)


def validate_path(relative_path: str) -> bool:
    """
    Validate that a relative path is safe and doesn't escape ROOT_PATH.
    
    Args:
        relative_path: Path relative to ROOT_PATH
        
    Returns:
        True if path is safe, False otherwise
    """
    # Prevent path traversal
    if ".." in relative_path or relative_path.startswith("/"):
        return False
    
    # Resolve to absolute path and check it's within ROOT_PATH
    try:
        abs_path = os.path.abspath(os.path.join(ROOT_PATH, relative_path))
        return abs_path.startswith(ROOT_PATH)
    except Exception:
        return False


def get_absolute_path(relative_path: str) -> str:
    """
    Get absolute path from relative path within ROOT_PATH.
    
    Args:
        relative_path: Path relative to ROOT_PATH
        
    Returns:
        Absolute path
        
    Raises:
        ValueError: If path is not safe
    """
    if not validate_path(relative_path):
        raise ValueError(f"Invalid or unsafe path: {relative_path}")
    return os.path.abspath(os.path.join(ROOT_PATH, relative_path))

