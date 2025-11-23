/** Tree view component with drag and drop support. */

import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { TreeNode } from '../types/tree';
import { TreeNodeItem } from './TreeNodeItem';
import { useTheme } from '../contexts/ThemeContext';
import { findParentFolder } from '../utils/treeUtils';

interface TreeViewProps {
  tree: TreeNode | null;
  onNodeMove?: (nodeId: string, targetFolderId: string) => void;
  onSelectNode?: (node: TreeNode) => void;
  onCreateFolder?: (parentFolderId: string, folderName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onExcludeNode?: (nodeId: string) => void;
  readOnly?: boolean;
  title?: string;
}

function DroppableFolder({ node, level, isExpanded, onToggle, children, onSelect, onContextMenu, readOnly, colors }: {
  node: TreeNode;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  onSelect?: (node: TreeNode) => void;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
  readOnly?: boolean;
  colors: any;
}) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: node.id,
    data: {
      node,
      type: 'folder',
    },
    disabled: readOnly,
  });

  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: {
      node,
    },
    disabled: readOnly,
  });

  const indent = level * 20;

  // Combine refs
  const setCombinedRef = (el: HTMLDivElement | null) => {
    setDroppableRef(el);
    setDraggableRef(el);
  };

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setCombinedRef}
      style={{
        backgroundColor: isOver ? colors.active : 'transparent',
        border: isOver ? `2px dashed ${colors.primary}` : '2px solid transparent',
        paddingLeft: `${indent}px`,
        opacity: isDragging ? 0.5 : 1,
        borderRadius: '6px',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        ...dragStyle,
      }}
      {...(!readOnly ? listeners : {})}
      {...(!readOnly ? attributes : {})}
    >
      <div
        style={{
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: readOnly ? 'default' : 'grab',
          color: colors.text,
          borderRadius: '4px',
        }}
        onClick={(e) => {
          // Toggle folder when clicking on name
          e.stopPropagation();
          onToggle();
          onSelect?.(node);
        }}
        onContextMenu={(e) => onContextMenu?.(e, node)}
        onMouseEnter={(e) => {
          if (!isOver) {
            e.currentTarget.style.backgroundColor = colors.hover;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            width: '16px',
            height: '16px',
          }}
        >
          {isExpanded ? '📂' : '📁'}
        </button>
        <span style={{ cursor: 'pointer', userSelect: 'none' }}>{node.name}</span>
      </div>
      {isExpanded && children}
    </div>
  );
}

export function TreeView({ 
  tree, 
  onNodeMove, 
  onSelectNode, 
  onCreateFolder, 
  onDeleteFolder,
  onRenameFolder,
  onExcludeNode,
  readOnly = false, 
  title 
}: TreeViewProps) {
  const { colors } = useTheme();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['.']));
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string>('.');
  const [newFolderName, setNewFolderName] = useState('');
  const [renameNodeId, setRenameNodeId] = useState<string>('');
  const [renameNodeName, setRenameNodeName] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const node = event.active.data.current?.node as TreeNode | undefined;
    if (node) {
      setDraggedNode(node);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedNode(null);
    
    if (!onNodeMove || readOnly || !tree) return;

    const { active, over } = event;
    if (!over) return;

    const draggedNodeData = active.data.current?.node as TreeNode | undefined;
    const targetNodeData = over.data.current?.node as TreeNode | undefined;

    if (!draggedNodeData || !targetNodeData) return;

    // Don't allow moving a node onto itself
    if (draggedNodeData.id === targetNodeData.id) return;

    let targetFolderId: string;

    if (targetNodeData.type === 'folder') {
      // Dropping on a folder - move to that folder
      targetFolderId = targetNodeData.id;
    } else {
      // Dropping on a file - move to the parent folder of that file
      // Find the parent folder of the target file
      const parentFolder = findParentFolder(tree, targetNodeData.id);
      if (!parentFolder) {
        // If no parent found (shouldn't happen), use root
        targetFolderId = tree.id;
      } else {
        targetFolderId = parentFolder.id;
      }
    }

    onNodeMove(draggedNodeData.id, targetFolderId);
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleCreateFolderClick = (parentFolderId: string = '.') => {
    setCreateFolderParentId(parentFolderId);
    setNewFolderName('');
    setShowCreateFolderDialog(true);
    setContextMenu(null);
  };

  const handleCreateFolderConfirm = () => {
    if (!onCreateFolder || !newFolderName.trim()) return;
    onCreateFolder(createFolderParentId, newFolderName.trim());
    setShowCreateFolderDialog(false);
    setNewFolderName('');
    // Expand the parent folder to show the new folder
    setExpandedNodes(prev => new Set(prev).add(createFolderParentId));
  };

  const handleDeleteFolder = () => {
    if (!onDeleteFolder || !contextMenu) return;
    onDeleteFolder(contextMenu.node.id);
    setContextMenu(null);
  };

  const handleRenameFolder = () => {
    if (!contextMenu) return;
    setRenameNodeId(contextMenu.node.id);
    setRenameNodeName(contextMenu.node.name);
    setShowRenameDialog(true);
    setContextMenu(null);
  };

  const handleRenameConfirm = () => {
    if (!onRenameFolder || !renameNodeName.trim()) return;
    onRenameFolder(renameNodeId, renameNodeName.trim());
    setShowRenameDialog(false);
    setRenameNodeId('');
    setRenameNodeName('');
  };

  const handleExcludeNode = () => {
    if (!onExcludeNode || !contextMenu) return;
    onExcludeNode(contextMenu.node.id);
    setContextMenu(null);
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  const renderTree = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isFolder = node.type === 'folder';

    if (isFolder) {
      return (
        <DroppableFolder
          key={node.id}
          node={node}
          level={level}
          isExpanded={isExpanded}
          onToggle={() => toggleNode(node.id)}
          onSelect={onSelectNode}
          onContextMenu={handleContextMenu}
          readOnly={readOnly}
          colors={colors}
        >
          {isExpanded && node.children?.map(child => renderTree(child, level + 1))}
        </DroppableFolder>
      );
    } else {
      return (
        <TreeNodeItem
          key={node.id}
          node={node}
          level={level}
          isExpanded={false}
          onToggle={() => {}}
          onSelect={onSelectNode}
          onContextMenu={handleContextMenu}
          readOnly={readOnly}
        />
      );
    }
  };

  if (!tree) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: colors.textSecondary,
        backgroundColor: colors.surface,
        borderRadius: '8px',
      }}>
        No tree data available
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ 
        border: `1px solid ${colors.border}`, 
        borderRadius: '12px', 
        padding: '20px', 
        height: '100%', 
        overflow: 'auto', 
        position: 'relative',
        backgroundColor: colors.surface,
        boxShadow: `0 2px 8px ${colors.shadow}`,
      }}>
        {title && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: 0, 
              fontSize: '18px', 
              fontWeight: '600',
              color: colors.text,
            }}>
              {title}
            </h3>
          </div>
        )}
        <div>
          {/* Root node */}
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              color: colors.text,
              borderRadius: '6px',
              transition: 'background-color 0.2s ease',
              cursor: 'pointer',
            }}
            onClick={() => toggleNode(tree.id)}
            onContextMenu={(e) => !readOnly && onCreateFolder && handleContextMenu(e, tree)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(tree.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                width: '20px',
                height: '20px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {expandedNodes.has(tree.id) ? '📂' : '📁'}
            </button>
            <span style={{ cursor: 'pointer', userSelect: 'none' }}>{tree.name || 'Root'}</span>
          </div>
          {expandedNodes.has(tree.id) && tree.children?.map(child => renderTree(child, 1))}
        </div>
      </div>
      <DragOverlay>
        {draggedNode ? (
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: colors.surface, 
            border: `2px solid ${colors.primary}`, 
            borderRadius: '8px',
            boxShadow: `0 4px 12px ${colors.shadowHover}`,
            color: colors.text,
            fontWeight: '500',
          }}>
            {draggedNode.name}
          </div>
        ) : null}
      </DragOverlay>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            boxShadow: `0 4px 12px ${colors.shadowHover}`,
            zIndex: 1000,
            minWidth: '200px',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'folder' && onCreateFolder && (
            <button
              onClick={() => handleCreateFolderClick(contextMenu.node.id)}
              style={{
                width: '100%',
                padding: '10px 16px',
                textAlign: 'left',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                color: colors.text,
                transition: 'background-color 0.2s ease',
                borderBottom: `1px solid ${colors.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              📁 Create Folder
            </button>
          )}
          {contextMenu.node.type === 'folder' && onRenameFolder && (
            <button
              onClick={handleRenameFolder}
              style={{
                width: '100%',
                padding: '10px 16px',
                textAlign: 'left',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                color: colors.text,
                transition: 'background-color 0.2s ease',
                borderBottom: contextMenu.node.type === 'folder' && onDeleteFolder ? `1px solid ${colors.border}` : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ✏️ Rename Folder
            </button>
          )}
          {contextMenu.node.type === 'folder' && onDeleteFolder && (
            <button
              onClick={handleDeleteFolder}
              style={{
                width: '100%',
                padding: '10px 16px',
                textAlign: 'left',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                color: colors.error,
                transition: 'background-color 0.2s ease',
                borderBottom: onExcludeNode ? `1px solid ${colors.border}` : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.errorBackground;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              🗑️ Delete Folder
            </button>
          )}
          {onExcludeNode && (
            <button
              onClick={handleExcludeNode}
              style={{
                width: '100%',
                padding: '10px 16px',
                textAlign: 'left',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                color: colors.text,
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              🚫 Exclude {contextMenu.node.type === 'folder' ? 'Folder' : 'File'}
            </button>
          )}
        </div>
      )}

      {/* Create Folder Dialog */}
      {showCreateFolderDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowCreateFolderDialog(false)}
        >
          <div
            style={{
              backgroundColor: colors.surface,
              padding: '28px',
              borderRadius: '12px',
              minWidth: '320px',
              boxShadow: `0 8px 24px ${colors.shadowHover}`,
              border: `1px solid ${colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '20px',
              color: colors.text,
              fontSize: '20px',
              fontWeight: '600',
            }}>Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolderConfirm();
                } else if (e.key === 'Escape') {
                  setShowCreateFolderDialog(false);
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                marginBottom: '20px',
                boxSizing: 'border-box',
                backgroundColor: colors.surfaceElevated,
                color: colors.text,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateFolderDialog(false)}
                style={{
                  padding: '10px 20px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surface;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolderConfirm}
                disabled={!newFolderName.trim()}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: newFolderName.trim() ? colors.primary : colors.border,
                  color: newFolderName.trim() ? colors.primaryText : colors.textSecondary,
                  cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (newFolderName.trim()) {
                    e.currentTarget.style.backgroundColor = colors.primaryHover;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (newFolderName.trim()) {
                    e.currentTarget.style.backgroundColor = colors.primary;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Dialog */}
      {showRenameDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowRenameDialog(false)}
        >
          <div
            style={{
              backgroundColor: colors.surface,
              padding: '28px',
              borderRadius: '12px',
              minWidth: '320px',
              boxShadow: `0 8px 24px ${colors.shadowHover}`,
              border: `1px solid ${colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '20px',
              color: colors.text,
              fontSize: '20px',
              fontWeight: '600',
            }}>Rename Folder</h3>
            <input
              type="text"
              value={renameNodeName}
              onChange={(e) => setRenameNodeName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameConfirm();
                } else if (e.key === 'Escape') {
                  setShowRenameDialog(false);
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                marginBottom: '20px',
                boxSizing: 'border-box',
                backgroundColor: colors.surfaceElevated,
                color: colors.text,
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRenameDialog(false)}
                style={{
                  padding: '10px 20px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surface;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameConfirm}
                disabled={!renameNodeName.trim()}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: renameNodeName.trim() ? colors.primary : colors.border,
                  color: renameNodeName.trim() ? colors.primaryText : colors.textSecondary,
                  cursor: renameNodeName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (renameNodeName.trim()) {
                    e.currentTarget.style.backgroundColor = colors.primaryHover;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (renameNodeName.trim()) {
                    e.currentTarget.style.backgroundColor = colors.primary;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

