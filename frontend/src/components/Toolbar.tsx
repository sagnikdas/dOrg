/** Toolbar component with action buttons. */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface ToolbarProps {
  onReset: () => void;
  onApply: () => void;
  onUndo?: () => void;
  isLoading?: boolean;
  hasChanges?: boolean;
  canUndo?: boolean;
}

export function Toolbar({ onReset, onApply, onUndo, isLoading = false, hasChanges = false, canUndo = false }: ToolbarProps) {
  const { colors } = useTheme();
  
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '20px 24px',
        borderTop: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        boxShadow: `0 -2px 8px ${colors.shadow}`,
      }}
    >
      <button
        onClick={onReset}
        disabled={isLoading}
        style={{
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: '600',
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          cursor: !isLoading ? 'pointer' : 'not-allowed',
          backgroundColor: !isLoading ? colors.surface : colors.hover,
          color: !isLoading ? colors.text : colors.textSecondary,
          transition: 'all 0.2s ease',
          boxShadow: `0 2px 4px ${colors.shadow}`,
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.backgroundColor = colors.hover;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 4px 8px ${colors.shadowHover}`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            e.currentTarget.style.backgroundColor = colors.surface;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 2px 4px ${colors.shadow}`;
          }
        }}
      >
        Reset Draft
      </button>
      <button
        onClick={onApply}
        disabled={isLoading || !hasChanges}
        style={{
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: '600',
          border: 'none',
          borderRadius: '8px',
          cursor: !isLoading && hasChanges ? 'pointer' : 'not-allowed',
          backgroundColor: !isLoading && hasChanges ? colors.primary : colors.border,
          color: !isLoading && hasChanges ? colors.primaryText : colors.textSecondary,
          transition: 'all 0.2s ease',
          boxShadow: `0 2px 4px ${colors.shadow}`,
        }}
        onMouseEnter={(e) => {
          if (!isLoading && hasChanges) {
            e.currentTarget.style.backgroundColor = colors.primaryHover;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 4px 8px ${colors.shadowHover}`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading && hasChanges) {
            e.currentTarget.style.backgroundColor = colors.primary;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 2px 4px ${colors.shadow}`;
          }
        }}
      >
        {isLoading ? 'Applying...' : 'Apply Changes'}
      </button>
      {onUndo && (
        <button
          onClick={onUndo}
          disabled={isLoading || !canUndo}
          style={{
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '600',
            border: `1px solid ${canUndo && !isLoading ? colors.primary : colors.border}`,
            borderRadius: '8px',
            cursor: canUndo && !isLoading ? 'pointer' : 'not-allowed',
            backgroundColor: canUndo && !isLoading ? colors.surface : colors.hover,
            color: canUndo && !isLoading ? colors.primary : colors.textSecondary,
            transition: 'all 0.2s ease',
            boxShadow: `0 2px 4px ${colors.shadow}`,
          }}
          onMouseEnter={(e) => {
            if (canUndo && !isLoading) {
              e.currentTarget.style.backgroundColor = colors.active;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 4px 8px ${colors.shadowHover}`;
            }
          }}
          onMouseLeave={(e) => {
            if (canUndo && !isLoading) {
              e.currentTarget.style.backgroundColor = colors.surface;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 2px 4px ${colors.shadow}`;
            }
          }}
        >
          Undo Last Move
        </button>
      )}
    </div>
  );
}

