/** Tree view component with drag and drop support. */

import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { TreeNode } from '../types/tree';
import { TreeNodeItem } from './TreeNodeItem';
import { useTheme } from '../contexts/ThemeContext';

interface TreeViewProps {
  tree: TreeNode | null;
  onNodeMove?: (nodeId: string, targetFolderId: string) => void;
  onSelectNode?: (node: TreeNode) => void;
  onCreateFolder?: (parentFolderId: string, folderName: string) => void;
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
        onClick={() => onSelect?.(node)}
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
        <span>{node.name}</span>
      </div>
      {isExpanded && children}
    </div>
  );
}

export function TreeView({ tree, onNodeMove, onSelectNode, onCreateFolder, readOnly = false, title }: TreeViewProps) {
  const { colors } = useTheme();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['.']));
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string>('.');
  const [newFolderName, setNewFolderName] = useState('');

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
    
    if (!onNodeMove || readOnly) return;

    const { active, over } = event;
    if (!over) return;

    const draggedNodeData = active.data.current?.node as TreeNode | undefined;
    const targetNodeData = over.data.current?.node as TreeNode | undefined;

    if (!draggedNodeData || !targetNodeData) return;

    // Only allow dropping on folders
    if (targetNodeData.type !== 'folder') return;

    // Don't allow moving a node onto itself
    if (draggedNodeData.id === targetNodeData.id) return;

    onNodeMove(draggedNodeData.id, targetNodeData.id);
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    if (readOnly || !onCreateFolder || node.type !== 'folder') return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId: node.id });
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
            {!readOnly && onCreateFolder && (
              <button
                onClick={() => handleCreateFolderClick('.')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: colors.primary,
                  color: colors.primaryText,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  boxShadow: `0 2px 4px ${colors.shadow}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primaryHover;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 4px 8px ${colors.shadowHover}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.primary;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 2px 4px ${colors.shadow}`;
                }}
              >
                + Create Folder
              </button>
            )}
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
            }}
            onContextMenu={(e) => !readOnly && onCreateFolder && handleContextMenu(e, tree)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <button
              onClick={() => toggleNode(tree.id)}
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
            <span>{tree.name || 'Root'}</span>
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
            minWidth: '180px',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleCreateFolderClick(contextMenu.folderId)}
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
            📁 Create Folder
          </button>
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
    </DndContext>
  );
}

