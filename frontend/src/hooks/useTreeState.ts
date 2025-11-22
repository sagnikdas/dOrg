/** Custom hook for managing tree state. */

import { useState, useCallback } from 'react';
import { TreeNode } from '../types/tree';
import { deepCloneTree, removeNodeById, addNodeToParent, findNodeById, updateNodePath } from '../utils/treeUtils';

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

  return {
    originalTree,
    draftTree,
    resetDraft,
    updateOriginalTree,
    moveNode,
    createFolder,
  };
}

