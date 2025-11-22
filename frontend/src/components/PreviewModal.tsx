/** Modal component for previewing planned moves. */

import React from 'react';
import { MoveResponse } from '../types/moves';
import { useTheme } from '../contexts/ThemeContext';

interface PreviewModalProps {
  response: MoveResponse;
  onClose: () => void;
  onConfirm?: () => void;
  showConfirm?: boolean;
}

export function PreviewModal({ response, onClose, onConfirm, showConfirm = false }: PreviewModalProps) {
  const { colors } = useTheme();
  const successCount = response.results.filter(r => 
    r.status === 'dry_ok' || r.status === 'moved' || r.status === 'moved_fallback'
  ).length;
  const skipCount = response.results.filter(r => r.status === 'skip').length;
  const errorCount = response.results.filter(r => r.status === 'error').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'dry_ok':
      case 'moved':
      case 'moved_fallback':
        return '#4caf50';
      case 'skip':
        return '#ff9800';
      case 'error':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '800px',
          maxHeight: '80vh',
          overflow: 'auto',
          width: '90%',
          boxShadow: `0 8px 24px ${colors.shadowHover}`,
          border: `1px solid ${colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ 
          marginTop: 0,
          marginBottom: '20px',
          color: colors.text,
          fontSize: '24px',
          fontWeight: '600',
        }}>
          {response.dry_run ? 'Preview Changes' : 'Move Results'}
        </h2>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: colors.text, marginBottom: '8px' }}>
            <strong>Planned moves:</strong> {response.results.length}
          </p>
          <p style={{ color: '#4caf50', marginBottom: '8px' }}>
            <strong>Success:</strong> {successCount}
          </p>
          {skipCount > 0 && (
            <p style={{ color: '#ff9800', marginBottom: '8px' }}>
              <strong>Will be skipped:</strong> {skipCount}
            </p>
          )}
          {errorCount > 0 && (
            <p style={{ color: colors.error, marginBottom: '8px' }}>
              <strong>Errors:</strong> {errorCount}
            </p>
          )}
        </div>

        <div style={{ 
          maxHeight: '400px', 
          overflow: 'auto', 
          border: `1px solid ${colors.border}`, 
          borderRadius: '8px',
          backgroundColor: colors.surfaceElevated,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ 
                backgroundColor: colors.surface, 
                position: 'sticky', 
                top: 0,
                borderBottom: `2px solid ${colors.border}`,
              }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  color: colors.text,
                  fontWeight: '600',
                }}>From</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  color: colors.text,
                  fontWeight: '600',
                }}>To</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  color: colors.text,
                  fontWeight: '600',
                }}>Status</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  color: colors.text,
                  fontWeight: '600',
                }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {response.results.map((result, index) => (
                <tr 
                  key={index} 
                  style={{ 
                    borderBottom: `1px solid ${colors.border}`,
                    backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceElevated,
                  }}
                >
                  <td style={{ 
                    padding: '10px 12px', 
                    fontSize: '13px', 
                    fontFamily: 'monospace',
                    color: colors.text,
                  }}>
                    {result.from_path}
                  </td>
                  <td style={{ 
                    padding: '10px 12px', 
                    fontSize: '13px', 
                    fontFamily: 'monospace',
                    color: colors.text,
                  }}>
                    {result.to_path}
                  </td>
                  <td style={{ 
                    padding: '10px 12px', 
                    color: getStatusColor(result.status),
                    fontWeight: '500',
                  }}>
                    {result.status}
                  </td>
                  <td style={{ 
                    padding: '10px 12px', 
                    fontSize: '12px', 
                    color: colors.textSecondary,
                  }}>
                    {result.reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: colors.surface,
              color: colors.text,
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
            {showConfirm ? 'Cancel' : 'Close'}
          </button>
          {showConfirm && onConfirm && (
            <button
              onClick={onConfirm}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: colors.primary,
                color: colors.primaryText,
                fontWeight: '600',
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
              Confirm & Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

