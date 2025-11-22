/** Utility functions for tree operations. */

import { TreeNode } from '../types/tree';

/**
 * Deep clone a TreeNode.
 */
export function deepCloneTree(node: TreeNode): TreeNode {
  return {
    ...node,
    children: node.children ? node.children.map(child => deepCloneTree(child)) : undefined,
  };
}

/**
 * Find a node by ID in the tree.
 */
export function findNodeById(tree: TreeNode, id: string): TreeNode | null {
  if (tree.id === id) {
    return tree;
  }
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Remove a node from the tree by ID.
 */
export function removeNodeById(tree: TreeNode, id: string): TreeNode | null {
  if (tree.id === id) {
    return null;
  }
  if (tree.children) {
    const filteredChildren = tree.children
      .map(child => removeNodeById(child, id))
      .filter((child): child is TreeNode => child !== null);
    
    return {
      ...tree,
      children: filteredChildren.length > 0 ? filteredChildren : undefined,
    };
  }
  return tree;
}

/**
 * Add a node to a parent node by ID.
 */
export function addNodeToParent(tree: TreeNode, parentId: string, newNode: TreeNode): TreeNode {
  if (tree.id === parentId) {
    return {
      ...tree,
      children: [...(tree.children || []), newNode],
    };
  }
  if (tree.children) {
    return {
      ...tree,
      children: tree.children.map(child => addNodeToParent(child, parentId, newNode)),
    };
  }
  return tree;
}

/**
 * Update relative paths for a node and all its children based on new parent path.
 */
export function updateNodePath(node: TreeNode, newParentPath: string): TreeNode {
  const newRelativePath = newParentPath === '.' 
    ? node.name 
    : `${newParentPath}/${node.name}`;
  
  return {
    ...node,
    relative_path: newRelativePath,
    id: newRelativePath,
    children: node.children
      ? node.children.map(child => updateNodePath(child, newRelativePath))
      : undefined,
  };
}

/**
 * Build a map of node ID to relative path for quick lookup.
 */
export function buildPathMap(tree: TreeNode, map: Map<string, string> = new Map()): Map<string, string> {
  map.set(tree.id, tree.relative_path);
  if (tree.children) {
    for (const child of tree.children) {
      buildPathMap(child, map);
    }
  }
  return map;
}

/**
 * Compute the moves needed to transform originalTree into draftTree.
 * Matches nodes by finding them in both trees and comparing their paths.
 */
export function computeMoves(originalTree: TreeNode, draftTree: TreeNode): Array<{ from_path: string; to_path: string }> {
  const moves: Array<{ from_path: string; to_path: string }> = [];
  
  // Build a map of all nodes in the original tree by their original relative_path
  const originalNodesByPath = new Map<string, TreeNode>();
  
  function collectOriginalNodes(node: TreeNode): void {
    originalNodesByPath.set(node.relative_path, node);
    if (node.children) {
      for (const child of node.children) {
        collectOriginalNodes(child);
      }
    }
  }
  
  collectOriginalNodes(originalTree);
  
  // Build a map of all nodes in the draft tree by their current relative_path
  const draftNodesByPath = new Map<string, TreeNode>();
  
  function collectDraftNodes(node: TreeNode): void {
    draftNodesByPath.set(node.relative_path, node);
    if (node.children) {
      for (const child of node.children) {
        collectDraftNodes(child);
      }
    }
  }
  
  collectDraftNodes(draftTree);
  
  // For each node in the original tree, find where it is in the draft tree
  // We match nodes by searching for a node with the same name and type
  // that appears at a different path
  for (const [originalPath, originalNode] of originalNodesByPath.entries()) {
    // Skip the root node
    if (originalPath === '.') continue;
    
    // Find the corresponding node in the draft tree
    // We need to search by name and type since the path might have changed
    const draftNode = findMatchingNodeInDraft(draftTree, originalNode, originalPath);
    
    if (draftNode && draftNode.relative_path !== originalPath) {
      // Node was moved to a different path
      moves.push({
        from_path: originalPath,
        to_path: draftNode.relative_path,
      });
    }
  }
  
  // Helper function to find a node in the draft tree that matches the original node
  function findMatchingNodeInDraft(
    draftTree: TreeNode,
    originalNode: TreeNode,
    originalPath: string
  ): TreeNode | null {
    // If we find a node at the same path with matching name and type, it's the same node (not moved)
    const nodeAtOriginalPath = draftNodesByPath.get(originalPath);
    if (nodeAtOriginalPath && 
        nodeAtOriginalPath.name === originalNode.name && 
        nodeAtOriginalPath.type === originalNode.type) {
      // Node is still at the same location
      return nodeAtOriginalPath;
    }
    
    // Search the entire draft tree for a matching node (same name and type)
    // We'll use a simple recursive search
    function searchTree(node: TreeNode): TreeNode | null {
      // Skip if this is the node at the original path (we already checked it)
      if (node.relative_path === originalPath) {
        // Continue searching children
        if (node.children) {
          for (const child of node.children) {
            const found = searchTree(child);
            if (found) return found;
          }
        }
        return null;
      }
      
      // Check if this node matches
      if (node.name === originalNode.name && node.type === originalNode.type) {
        // For a more robust match, we could also check children structure
        // But for now, name + type should be sufficient for most cases
        return node;
      }
      
      // Recursively search children
      if (node.children) {
        for (const child of node.children) {
          const found = searchTree(child);
          if (found) return found;
        }
      }
      
      return null;
    }
    
    return searchTree(draftTree);
  }
  
  return moves;
}

