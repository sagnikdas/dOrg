/** Main application component. */

import React, { useEffect, useState, useMemo } from 'react';
import { useTreeState } from './hooks/useTreeState';
import { fetchTree, applyMoves, undoLastMoves, checkUndoStatus } from './api/filesystem';
import { computeMoves } from './utils/treeUtils';
import { TreeView } from './components/TreeView';
import { Toolbar } from './components/Toolbar';
import { PreviewModal } from './components/PreviewModal';
import { MoveResponse, MoveItem } from './types/moves';
import { TreeNode } from './types/tree';
import { useTheme } from './contexts/ThemeContext';

function App() {
  const { colors, theme, toggleTheme } = useTheme();
  const { originalTree, draftTree, resetDraft, updateOriginalTree, moveNode, createFolder } = useTreeState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewResponse, setPreviewResponse] = useState<MoveResponse | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);

  // Fetch tree on mount
  useEffect(() => {
    loadTree();
    checkUndoAvailability();
  }, []);

  // Handle global mouse events for resizing
  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        const container = document.querySelector('[data-panel-container]') as HTMLElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
          // Constrain between 20% and 80%
          const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
          setLeftPanelWidth(constrainedWidth);
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Check undo availability periodically
  const checkUndoAvailability = async () => {
    try {
      const status = await checkUndoStatus();
      setCanUndo(status.can_undo);
    } catch (err) {
      console.error('Error checking undo status:', err);
      setCanUndo(false);
    }
  };

  const loadTree = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const tree = await fetchTree();
      updateOriginalTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tree');
      console.error('Error loading tree:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const moves = useMemo(() => {
    if (!originalTree || !draftTree) return [];
    return computeMoves(originalTree, draftTree);
  }, [originalTree, draftTree]);
  
  const hasChanges = moves.length > 0;
  
  // Debug logging
  useEffect(() => {
    if (originalTree && draftTree) {
      console.log('Computed moves:', moves);
      console.log('Has changes:', hasChanges);
    }
  }, [originalTree, draftTree, moves, hasChanges]);

  const handlePreview = async () => {
    if (!originalTree || !draftTree) {
      console.warn('Cannot preview: missing tree data');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const computedMoves: MoveItem[] = computeMoves(originalTree, draftTree);
      console.log('Preview: computed moves:', computedMoves);
      
      if (computedMoves.length === 0) {
        setError('No changes detected. Try moving files/folders in the draft tree.');
        setIsLoading(false);
        return;
      }
      
      const response = await applyMoves({ moves: computedMoves, dry_run: true });
      console.log('Preview response:', response);
      setPreviewResponse(response);
      setShowPreviewModal(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to preview changes';
      setError(errorMessage);
      console.error('Error previewing changes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!originalTree || !draftTree) {
      console.warn('Cannot apply: missing tree data');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // First show preview
      const computedMoves: MoveItem[] = computeMoves(originalTree, draftTree);
      console.log('Apply: computed moves:', computedMoves);
      
      if (computedMoves.length === 0) {
        setError('No changes to apply. Try moving files/folders in the draft tree.');
        setIsLoading(false);
        return;
      }
      
      const previewResponse = await applyMoves({ moves: computedMoves, dry_run: true });
      console.log('Apply preview response:', previewResponse);
      setPreviewResponse(previewResponse);
      setShowPreviewModal(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to preview changes';
      setError(errorMessage);
      console.error('Error previewing changes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!originalTree || !draftTree || !previewResponse) return;

    try {
      setIsLoading(true);
      setError(null);
      const moves: MoveItem[] = computeMoves(originalTree, draftTree);
      const response = await applyMoves({ moves, dry_run: false });
      setPreviewResponse(response);
      
      // Reload tree after successful moves
      if (response.results.some(r => r.status === 'moved' || r.status === 'moved_fallback')) {
        await loadTree();
        await checkUndoAvailability();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
      console.error('Error applying changes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await undoLastMoves();
      console.log('Undo result:', result);
      
      // Reload tree to reflect undone moves
      await loadTree();
      await checkUndoAvailability();
      
      setError(null);
      // Show success message
      alert(result.message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to undo moves';
      setError(errorMessage);
      console.error('Error undoing moves:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !originalTree) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: colors.background,
        color: colors.text,
        height: '100vh',
      }}>
        <p>Loading tree...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: colors.background,
      color: colors.text,
      transition: 'background-color 0.3s ease, color 0.3s ease',
    }}>
      <header style={{ 
        padding: '16px 24px', 
        borderBottom: `1px solid ${colors.border}`, 
        backgroundColor: colors.surface,
        boxShadow: `0 2px 4px ${colors.shadow}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '24px',
          fontWeight: '600',
          color: colors.text,
        }}>File Reorganization Tool</h1>
        
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            padding: '8px 16px',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            backgroundColor: colors.surface,
            color: colors.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            boxShadow: `0 2px 4px ${colors.shadow}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.hover;
            e.currentTarget.style.borderColor = colors.borderHover;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 4px 8px ${colors.shadowHover}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.surface;
            e.currentTarget.style.borderColor = colors.border;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 2px 4px ${colors.shadow}`;
          }}
        >
          <span style={{ fontSize: '18px' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </span>
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        {error && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              backgroundColor: colors.errorBackground,
              color: colors.error,
              borderRadius: '8px',
              border: `1px solid ${colors.error}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong>Error:</strong> {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '12px',
                padding: '6px 12px',
                border: `1px solid ${colors.error}`,
                borderRadius: '6px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: colors.error,
                fontWeight: '500',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.error;
                e.currentTarget.style.color = colors.surface;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = colors.error;
              }}
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      <div 
        data-panel-container
        style={{ 
          flex: 1, 
          display: 'flex', 
          padding: '16px', 
          overflow: 'hidden',
          position: 'relative',
          userSelect: isResizing ? 'none' : 'auto',
          cursor: isResizing ? 'col-resize' : 'default',
          gap: '16px',
        }}
      >
        <div 
          style={{ 
            width: `${leftPanelWidth}%`, 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0,
            paddingRight: '8px',
          }}
        >
          <TreeView
            tree={originalTree}
            readOnly={true}
            title="Current Structure"
            onSelectNode={setSelectedNode}
          />
        </div>
        
        {/* Resizable divider */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          style={{
            width: '4px',
            backgroundColor: isResizing ? colors.primary : colors.divider,
            cursor: 'col-resize',
            flexShrink: 0,
            position: 'relative',
            transition: isResizing ? 'none' : 'background-color 0.2s',
            borderRadius: '2px',
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = colors.borderHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.backgroundColor = colors.divider;
            }
          }}
        >
          {/* Visual handle */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '20px',
              height: '40px',
              borderRadius: '4px',
              backgroundColor: isResizing ? colors.primary : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div style={{ 
                width: '3px', 
                height: '3px', 
                backgroundColor: isResizing ? colors.primaryText : colors.textSecondary, 
                borderRadius: '50%' 
              }} />
              <div style={{ 
                width: '3px', 
                height: '3px', 
                backgroundColor: isResizing ? colors.primaryText : colors.textSecondary, 
                borderRadius: '50%' 
              }} />
              <div style={{ 
                width: '3px', 
                height: '3px', 
                backgroundColor: isResizing ? colors.primaryText : colors.textSecondary, 
                borderRadius: '50%' 
              }} />
            </div>
          </div>
        </div>
        
        <div 
          style={{ 
            width: `${100 - leftPanelWidth}%`, 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0,
            paddingLeft: '8px',
          }}
        >
          <TreeView
            tree={draftTree}
            readOnly={false}
            title="Draft Structure (Drag & Drop to Reorganize)"
            onNodeMove={moveNode}
            onCreateFolder={createFolder}
            onSelectNode={setSelectedNode}
          />
        </div>
      </div>

      {selectedNode && (
        <div style={{
          padding: '12px 24px',
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          fontSize: '14px',
          color: colors.textSecondary,
        }}>
          <strong style={{ color: colors.text }}>Selected:</strong> {selectedNode.name} ({selectedNode.type})
          {selectedNode.size !== undefined && selectedNode.size !== null && (
            <span> - {(selectedNode.size / 1024).toFixed(2)} KB</span>
          )}
          <span> - Path: {selectedNode.relative_path}</span>
        </div>
      )}

      <Toolbar
        onReset={resetDraft}
        onApply={handleApply}
        onUndo={handleUndo}
        isLoading={isLoading}
        hasChanges={hasChanges || false}
        canUndo={canUndo}
      />

      {showPreviewModal && previewResponse && (
        <PreviewModal
          response={previewResponse}
          onClose={() => setShowPreviewModal(false)}
          onConfirm={previewResponse.dry_run ? handleConfirmApply : undefined}
          showConfirm={previewResponse.dry_run}
        />
      )}
    </div>
  );
}

export default App;

