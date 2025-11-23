/** Folder selection component for choosing the directory to organize. */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { setRootPath } from '../api/filesystem';

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
  currentPath?: string;
}

export function FolderSelector({ onFolderSelected, currentPath }: FolderSelectorProps) {
  const { colors } = useTheme();
  const [selectedPath, setSelectedPath] = useState<string>(currentPath || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedPath(e.target.value);
    setError(null);
  };

  const handleSelectFolder = async () => {
    if (!selectedPath.trim()) {
      setError('Please enter a folder path');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await setRootPath(selectedPath.trim());
      if (result.success) {
        onFolderSelected(result.root_path);
      } else {
        setError('Failed to set folder path');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set folder path');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSelectFolder();
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.background,
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <label
          htmlFor="folder-path"
          style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: colors.text,
          }}
        >
          Select Folder to Organize
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="folder-path"
            type="text"
            value={selectedPath}
            onChange={handlePathChange}
            onKeyPress={handleKeyPress}
            placeholder="/Users/username/Documents"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: '14px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              backgroundColor: colors.surface,
              color: colors.text,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSelectFolder}
            disabled={isLoading || !selectedPath.trim()}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#fff',
              backgroundColor: isLoading ? colors.border : colors.primary,
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading || !selectedPath.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !selectedPath.trim() ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Loading...' : 'Select Folder'}
          </button>
        </div>
        {error && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              color: '#ef4444',
              backgroundColor: '#fee2e2',
              borderRadius: '4px',
            }}
          >
            {error}
          </div>
        )}
        {currentPath && !error && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '13px',
              color: colors.textSecondary,
            }}
          >
            Current folder: <strong>{currentPath}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

