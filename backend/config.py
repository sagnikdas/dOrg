"""Configuration for the file reorganization backend."""

import os
from pathlib import Path

# Root directory of the HDD volume to manage
# Can be set via environment variable: export HDD_ROOT_PATH=/path/to/hdd
_default_root_path = os.getenv("HDD_ROOT_PATH", "/Users/sagnikdas/Downloads")
_default_root_path = os.path.abspath(_default_root_path)

# Runtime configurable root path (can be set via API)
_runtime_root_path: str | None = None


def get_root_path() -> str:
    """Get the current root path."""
    return _runtime_root_path if _runtime_root_path else _default_root_path


def set_root_path(path: str) -> bool:
    """
    Set the root path at runtime.
    
    Args:
        path: Absolute or relative path to set as root
        
    Returns:
        True if path is valid and set, False otherwise
    """
    global _runtime_root_path
    try:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path) and os.path.isdir(abs_path):
            _runtime_root_path = abs_path
            return True
        return False
    except Exception:
        return False


# For backward compatibility
ROOT_PATH = property(get_root_path)


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
        root = get_root_path()
        abs_path = os.path.abspath(os.path.join(root, relative_path))
        return abs_path.startswith(root)
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
    root = get_root_path()
    return os.path.abspath(os.path.join(root, relative_path))

