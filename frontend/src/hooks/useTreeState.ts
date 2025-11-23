/** Custom hook for managing tree state. */

import { useState, useCallback } from 'react';
import { TreeNode } from '../types/tree';
import { deepCloneTree, removeNodeById, addNodeToParent, findNodeById, updateNodePath, findParentFolder } from '../utils/treeUtils';

export function useTreeState(initialTree: TreeNode | null) {
  const [originalTree, setOriginalTree] = useState<TreeNode | null>(initialTree);
  const [draftTree, setDraftTree] = useState<TreeNode | null>(
    initialTree ? deepCloneTree(initialTree) : null
  );

  const resetDraft = useCallback(() => {
    if (originalTree) {
      setDraftTree(deepCloneTree(originalTree));
    }
  }, [originalTree]);

  const updateOriginalTree = useCallback((tree: TreeNode) => {
    setOriginalTree(tree);
    setDraftTree(deepCloneTree(tree));
  }, []);

  const moveNode = useCallback((nodeId: string, targetFolderId: string) => {
    if (!draftTree) return;

    const node = findNodeById(draftTree, nodeId);
    if (!node) return;

    // Find target folder
    const targetFolder = findNodeById(draftTree, targetFolderId);
    if (!targetFolder || targetFolder.type !== 'folder') return;

    // Don't allow moving a folder into itself or its children
    if (nodeId === targetFolderId) return;
    if (node.type === 'folder') {
      const isDescendant = findNodeById(node, targetFolderId) !== null;
      if (isDescendant) return;
    }

    // Get target folder path
    const targetPath = targetFolder.relative_path === '.' 
      ? '.' 
      : targetFolder.relative_path;

    // Remove node from current location
    const treeWithoutNode = removeNodeById(draftTree, nodeId);
    if (!treeWithoutNode) return;

    // Update node path based on new parent
    const updatedNode = updateNodePath(node, targetPath);

    // Add node to new location
    const newTree = addNodeToParent(treeWithoutNode, targetFolderId, updatedNode);
    setDraftTree(newTree);
  }, [draftTree]);

  const createFolder = useCallback((parentFolderId: string, folderName: string) => {
    if (!draftTree) return;

    // Find parent folder
    const parentFolder = findNodeById(draftTree, parentFolderId);
    if (!parentFolder || parentFolder.type !== 'folder') return;

    // Generate a unique folder name if one with the same name already exists
    let finalFolderName = folderName;
    let counter = 1;
    const existingNames = new Set(
      (parentFolder.children || []).map(child => child.name)
    );
    
    while (existingNames.has(finalFolderName)) {
      finalFolderName = `${folderName} (${counter})`;
      counter++;
    }

    // Get parent folder path
    const parentPath = parentFolder.relative_path === '.' 
      ? '.' 
      : parentFolder.relative_path;

    // Create new folder path
    const newFolderPath = parentPath === '.' 
      ? finalFolderName 
      : `${parentPath}/${finalFolderName}`;

    // Create new folder node
    const newFolder: TreeNode = {
      id: newFolderPath,
      name: finalFolderName,
      type: 'folder',
      relative_path: newFolderPath,
      children: [],
    };

    // Add folder to parent
    const newTree = addNodeToParent(draftTree, parentFolderId, newFolder);
    setDraftTree(newTree);
  }, [draftTree]);

  const deleteFolder = useCallback((folderId: string) => {
    if (!draftTree) return;
    
    // Don't allow deleting root
    if (folderId === draftTree.id) return;
    
    const newTree = removeNodeById(draftTree, folderId);
    if (newTree) {
      setDraftTree(newTree);
    }
  }, [draftTree]);

  const renameFolder = useCallback((folderId: string, newName: string) => {
    if (!draftTree) return;
    
    const folder = findNodeById(draftTree, folderId);
    if (!folder || folder.type !== 'folder') return;
    
    // Find parent to check for name conflicts
    const parent = findParentFolder(draftTree, folderId);
    if (parent && parent.children) {
      const existingNames = new Set(
        parent.children.filter(c => c.id !== folderId).map(c => c.name)
      );
      if (existingNames.has(newName)) {
        // Name conflict - could show error or auto-rename
        return;
      }
    }
    
    // Update folder name and paths
    const updatedFolder = {
      ...folder,
      name: newName,
      relative_path: folder.relative_path === folder.name 
        ? newName 
        : folder.relative_path.replace(`/${folder.name}`, `/${newName}`).replace(folder.name, newName),
      id: folder.relative_path === folder.name 
        ? newName 
        : folder.relative_path.replace(`/${folder.name}`, `/${newName}`).replace(folder.name, newName),
    };
    
    // Update all children paths
    if (updatedFolder.children) {
      updatedFolder.children = updatedFolder.children.map(child => 
        updateNodePath(child, updatedFolder.relative_path)
      );
    }
    
    // Remove old folder and add updated one
    const treeWithoutFolder = removeNodeById(draftTree, folderId);
    if (!treeWithoutFolder) return;
    
    const parentId = parent ? parent.id : draftTree.id;
    const newTree = addNodeToParent(treeWithoutFolder, parentId, updatedFolder);
    setDraftTree(newTree);
  }, [draftTree]);

  const excludeNode = useCallback((nodeId: string) => {
    if (!draftTree) return;
    
    // Don't allow excluding root
    if (nodeId === draftTree.id) return;
    
    const newTree = removeNodeById(draftTree, nodeId);
    if (newTree) {
      setDraftTree(newTree);
    }
  }, [draftTree]);

  const setDraftTreeDirectly = useCallback((tree: TreeNode) => {
    setDraftTree(tree);
  }, []);

  return {
    originalTree,
    draftTree,
    resetDraft,
    updateOriginalTree,
    moveNode,
    createFolder,
    deleteFolder,
    renameFolder,
    excludeNode,
    setDraftTreeDirectly,
  };
}

