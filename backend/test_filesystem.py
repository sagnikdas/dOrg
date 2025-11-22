"""Unit tests for filesystem operations."""

import pytest
import tempfile
import os
import shutil
from pathlib import Path

from filesystem import scan_tree, apply_moves
from models import MoveItem, TreeNode


@pytest.fixture
def temp_root():
    """Create a temporary directory structure for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create test structure
        os.makedirs(os.path.join(tmpdir, "folder1", "subfolder"))
        os.makedirs(os.path.join(tmpdir, "folder2"))
        
        # Create test files
        with open(os.path.join(tmpdir, "file1.txt"), "w") as f:
            f.write("content1")
        with open(os.path.join(tmpdir, "folder1", "file2.txt"), "w") as f:
            f.write("content2")
        with open(os.path.join(tmpdir, "folder1", "subfolder", "file3.txt"), "w") as f:
            f.write("content3")
        
        yield tmpdir


def test_scan_tree(temp_root):
    """Test tree scanning functionality."""
    tree = scan_tree(temp_root)
    
    assert tree.type == "folder"
    assert tree.name == os.path.basename(temp_root)
    
    # Check files and folders are found
    file_names = []
    folder_names = []
    
    def collect_nodes(node: TreeNode):
        if node.type == "file":
            file_names.append(node.name)
        else:
            folder_names.append(node.name)
            if node.children:
                for child in node.children:
                    collect_nodes(child)
    
    collect_nodes(tree)
    
    assert "file1.txt" in file_names
    assert "file2.txt" in file_names
    assert "file3.txt" in file_names
    assert "folder1" in folder_names
    assert "folder2" in folder_names


def test_apply_moves_dry_run(temp_root):
    """Test move operations in dry-run mode."""
    moves = [
        MoveItem(from_path="file1.txt", to_path="folder2/file1.txt"),
        MoveItem(from_path="folder1/file2.txt", to_path="folder2/file2.txt"),
    ]
    
    # Mock the config to use temp_root
    import filesystem
    original_root = filesystem.ROOT_PATH
    filesystem.ROOT_PATH = temp_root
    
    try:
        results = apply_moves(moves, dry_run=True)
        
        assert len(results) == 2
        assert results[0].status == "dry_ok"
        assert results[1].status == "dry_ok"
        
        # Verify files weren't actually moved
        assert os.path.exists(os.path.join(temp_root, "file1.txt"))
        assert os.path.exists(os.path.join(temp_root, "folder1", "file2.txt"))
    finally:
        filesystem.ROOT_PATH = original_root


def test_apply_moves_actual(temp_root):
    """Test actual move operations."""
    moves = [
        MoveItem(from_path="file1.txt", to_path="folder2/file1.txt"),
    ]
    
    # Mock the config to use temp_root
    import filesystem
    original_root = filesystem.ROOT_PATH
    filesystem.ROOT_PATH = temp_root
    
    try:
        results = apply_moves(moves, dry_run=False)
        
        assert len(results) == 1
        assert results[0].status in ["moved", "moved_fallback"]
        
        # Verify file was actually moved
        assert not os.path.exists(os.path.join(temp_root, "file1.txt"))
        assert os.path.exists(os.path.join(temp_root, "folder2", "file1.txt"))
    finally:
        filesystem.ROOT_PATH = original_root


def test_apply_moves_destination_exists(temp_root):
    """Test that moves are skipped when destination exists."""
    # Create destination file
    os.makedirs(os.path.join(temp_root, "folder2"), exist_ok=True)
    with open(os.path.join(temp_root, "folder2", "file1.txt"), "w") as f:
        f.write("existing")
    
    moves = [
        MoveItem(from_path="file1.txt", to_path="folder2/file1.txt"),
    ]
    
    # Mock the config to use temp_root
    import filesystem
    original_root = filesystem.ROOT_PATH
    filesystem.ROOT_PATH = temp_root
    
    try:
        results = apply_moves(moves, dry_run=False)
        
        assert len(results) == 1
        assert results[0].status == "skip"
        assert results[0].reason == "destination_exists"
        
        # Verify source still exists
        assert os.path.exists(os.path.join(temp_root, "file1.txt"))
    finally:
        filesystem.ROOT_PATH = original_root

