/** Main application component. */

import { useEffect, useState, useMemo } from 'react';
import { useTreeState } from './hooks/useTreeState';
import { fetchTree, applyMoves, undoLastMoves, checkUndoStatus } from './api/filesystem';
import { computeMoves, findNodeByPath, deepCloneTree, removeNodeById, addNodeToParent, updateNodePath } from './utils/treeUtils';
import { TreeView } from './components/TreeView';
import { Toolbar } from './components/Toolbar';
import { PreviewModal } from './components/PreviewModal';
import { LoginScreen } from './components/LoginScreen';
import { FolderSelector } from './components/FolderSelector';
import { ProgressBar } from './components/ProgressBar';
import { MoveResponse, MoveItem } from './types/moves';
import { TreeNode } from './types/tree';
import { useTheme } from './contexts/ThemeContext';
import { getToken, verifyToken, storeToken, getCurrentUser, User } from './api/auth';
import { organizeByFileType } from './api/filesystem';

function App() {
  const { colors, theme, toggleTheme } = useTheme();
  const { 
    originalTree, 
    draftTree, 
    resetDraft, 
    updateOriginalTree, 
    moveNode, 
    createFolder,
    deleteFolder,
    renameFolder,
    excludeNode,
    setDraftTreeDirectly
  } = useTreeState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewResponse, setPreviewResponse] = useState<MoveResponse | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [currentRootPath, setCurrentRootPath] = useState<string | null>(null);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizeProgress, setOrganizeProgress] = useState(0);

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  // Fetch tree on mount (only if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      loadTree();
      checkUndoAvailability();
    }
  }, [isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      const token = getToken();
      if (token) {
        const result = await verifyToken(token);
        if (result.valid && result.user) {
          setIsAuthenticated(true);
          setUser(result.user);
        } else {
          // Token is invalid
          localStorage.removeItem('auth_token');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginSuccess = async (token: string) => {
    try {
      storeToken(token);
      const userInfo = await getCurrentUser(token);
      setUser(userInfo);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login success error:', error);
      setError('Failed to get user information');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentRootPath(null);
  };

  const handleFolderSelected = async (path: string) => {
    setCurrentRootPath(path);
    // Reload tree after folder is selected
    await loadTree();
  };

  const handleOrganizeByType = async () => {
    if (!currentRootPath) {
      setError('Please select a folder first');
      return;
    }

    if (!originalTree || !draftTree) {
      setError('Tree not loaded. Please wait...');
      return;
    }

    try {
      setIsOrganizing(true);
      setOrganizeProgress(0);
      setError(null);
      
      // Fetch organization moves from backend
      const result = await organizeByFileType(currentRootPath);
      const totalMoves = result.moves.length;
      
      if (totalMoves === 0) {
        setError('No files to organize');
        setIsOrganizing(false);
        return;
      }
      
      // Start building the organized tree in memory
      // Clone the original tree as the base
      let organizedTree = deepCloneTree(originalTree);
      
      // Create a map to track created folders
      const folderMap = new Map<string, TreeNode>();
      folderMap.set('.', organizedTree);
      
      // Helper to get or create a folder
      const getOrCreateFolder = (path: string): TreeNode => {
        if (path === '.') return organizedTree;
        
        if (folderMap.has(path)) {
          return folderMap.get(path)!;
        }
        
        // Create folder path recursively
        const parts = path.split('/').filter(p => p !== '.' && p !== '');
        let currentPath = '.';
        let currentFolder = organizedTree;
        
        for (const part of parts) {
          const nextPath = currentPath === '.' ? part : `${currentPath}/${part}`;
          
          if (!folderMap.has(nextPath)) {
            // Check if folder already exists in tree
            let folder = findNodeByPath(currentFolder, nextPath);
            
            if (!folder) {
              // Create new folder
              folder = {
                id: nextPath,
                name: part,
                type: 'folder',
                relative_path: nextPath,
                children: [],
              };
              
              // Add to current folder
              if (!currentFolder.children) {
                currentFolder.children = [];
              }
              currentFolder.children.push(folder);
            }
            
            folderMap.set(nextPath, folder);
          }
          
          currentPath = nextPath;
          currentFolder = folderMap.get(nextPath)!;
        }
        
        return currentFolder;
      };
      
      // Apply all moves to build the organized tree
      for (let i = 0; i < result.moves.length; i++) {
        const move = result.moves[i];
        
        // Update progress
        setOrganizeProgress(Math.round(((i + 1) / totalMoves) * 100));
        
        // Find the node to move
        const nodeToMove = findNodeByPath(organizedTree, move.from_path);
        if (!nodeToMove) {
          console.warn(`Node not found: ${move.from_path}`);
          continue;
        }
        
        // Get target folder path
        const targetFolderPath = move.to_path.includes('/') 
          ? move.to_path.substring(0, move.to_path.lastIndexOf('/'))
          : '.';
        
        // Get or create target folder
        const targetFolder = getOrCreateFolder(targetFolderPath);
        
        if (targetFolder.type !== 'folder') {
          console.warn(`Target is not a folder: ${targetFolderPath}`);
          continue;
        }
        
        // Remove node from current location
        const treeAfterRemove = removeNodeById(organizedTree, nodeToMove.id);
        if (!treeAfterRemove) {
          console.error('Failed to remove node from tree');
          break;
        }
        
        // Update node path
        const updatedNode = updateNodePath(nodeToMove, targetFolder.relative_path);
        
        // Add node to target folder
        organizedTree = addNodeToParent(treeAfterRemove, targetFolder.id, updatedNode);
        
        // Update folder map if we added to a new folder
        if (!folderMap.has(targetFolder.id)) {
          folderMap.set(targetFolder.id, targetFolder);
        }
      }
      
      // Set the organized tree all at once (single state update)
      setDraftTreeDirectly(organizedTree);
      setOrganizeProgress(100);
      
      // Small delay to show 100% before hiding progress
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to organize files by type';
      setError(errorMessage);
      console.error('Error organizing by type:', err);
    } finally {
      setIsOrganizing(false);
      setOrganizeProgress(0);
    }
  };

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
      setError(null); // Clear any previous errors
      
      const result = await undoLastMoves();
      console.log('Undo result:', result);
      
      // If we got here, the API call succeeded
      // Check if undo was successful according to the response
      if (result && result.success !== false) {
        // Reload tree to reflect undone moves
        try {
          await loadTree();
          await checkUndoAvailability();
        } catch (reloadErr) {
          // If reload fails, log but don't show error since undo succeeded
          console.warn('Failed to reload tree after undo:', reloadErr);
        }
        
        // Clear any errors - undo was successful
        setError(null);
      } else {
        // Undo operation reported failure
        setError(result?.message || 'Failed to undo moves');
      }
    } catch (err) {
      // API call failed (network error, 500, etc.)
      const errorMessage = err instanceof Error ? err.message : 'Failed to undo moves';
      setError(errorMessage);
      console.error('Error undoing moves:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Show login screen if not authenticated
  if (authLoading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: colors.background,
        color: colors.text,
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '24px',
            fontWeight: '600',
            color: colors.text,
          }}>dOrg</h1>
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: colors.textSecondary,
            }}>
              {user.picture && (
                <img 
                  src={user.picture} 
                  alt={user.name}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                  }}
                />
              )}
              <span>{user.name || user.email}</span>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              backgroundColor: colors.surface,
              color: colors.text,
              cursor: 'pointer',
              fontSize: '14px',
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
            Logout
          </button>
          
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
        </div>
      </header>

      <FolderSelector
        onFolderSelected={handleFolderSelected}
        currentPath={currentRootPath || undefined}
      />

      {error && (
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: colors.errorBackground,
            color: colors.error,
            borderRadius: '0',
            borderBottom: `1px solid ${colors.error}`,
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

      {currentRootPath && (
        <div style={{
          padding: '12px 24px',
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '14px', color: colors.textSecondary }}>
            Organizing: <strong style={{ color: colors.text }}>{currentRootPath}</strong>
          </div>
          <button
            onClick={handleOrganizeByType}
            disabled={isOrganizing || isLoading}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '8px',
              cursor: isOrganizing || isLoading ? 'not-allowed' : 'pointer',
              backgroundColor: isOrganizing || isLoading ? colors.border : colors.primary,
              color: isOrganizing || isLoading ? colors.textSecondary : colors.primaryText,
              transition: 'all 0.2s ease',
              boxShadow: `0 2px 4px ${colors.shadow}`,
            }}
            onMouseEnter={(e) => {
              if (!isOrganizing && !isLoading) {
                e.currentTarget.style.backgroundColor = colors.primaryHover;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isOrganizing && !isLoading) {
                e.currentTarget.style.backgroundColor = colors.primary;
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isOrganizing ? 'Organizing...' : 'Organize by File Type'}
          </button>
        </div>
      )}

      {isOrganizing && (
        <ProgressBar
          progress={organizeProgress}
          label="Organizing files by type..."
          showPercentage={true}
        />
      )}

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
            onExcludeNode={excludeNode}
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
            onDeleteFolder={deleteFolder}
            onRenameFolder={renameFolder}
            onExcludeNode={excludeNode}
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

