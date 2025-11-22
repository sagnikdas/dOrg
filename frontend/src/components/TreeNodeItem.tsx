/** Individual tree node component with drag support. */

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TreeNode } from '../types/tree';
import { useTheme } from '../contexts/ThemeContext';

interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect?: (node: TreeNode) => void;
}

export function TreeNodeItem({ node, level, isExpanded, onToggle, onSelect }: TreeNodeItemProps) {
  const { colors } = useTheme();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: {
      node,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const indent = level * 20;
  const isFolder = node.type === 'folder';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        paddingLeft: `${indent}px`,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        padding: '6px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: isDragging ? colors.hover : 'transparent',
        borderRadius: '4px',
        color: colors.text,
        transition: 'background-color 0.2s ease',
      }}
      {...listeners}
      {...attributes}
      onClick={() => onSelect?.(node)}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.backgroundColor = colors.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {isFolder ? (
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hasChildren ? (isExpanded ? '📂' : '📁') : '📁'}
        </button>
      ) : (
        <span style={{ width: '16px', display: 'inline-block' }}>📄</span>
      )}
      <span>{node.name}</span>
      {node.size !== undefined && node.size !== null && (
        <span style={{ 
          fontSize: '12px', 
          color: colors.textSecondary, 
          marginLeft: 'auto',
          fontWeight: '500',
        }}>
          {(node.size / 1024).toFixed(2)} KB
        </span>
      )}
    </div>
  );
}

