/** Progress bar component for showing operation progress. */

import { useTheme } from '../contexts/ThemeContext';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ progress, label, showPercentage = true }: ProgressBarProps) {
  const { colors } = useTheme();
  
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div style={{
      width: '100%',
      padding: '16px 24px',
      backgroundColor: colors.surface,
      borderBottom: `1px solid ${colors.border}`,
    }}>
      {label && (
        <div style={{
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: colors.text,
        }}>
          {label}
        </div>
      )}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: colors.hover,
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div
          style={{
            width: `${clampedProgress}%`,
            height: '100%',
            backgroundColor: colors.primary,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
            position: 'relative',
          }}
        >
          {clampedProgress > 10 && showPercentage && (
            <span style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              fontWeight: '600',
              color: colors.primaryText,
            }}>
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      </div>
      {clampedProgress < 10 && showPercentage && (
        <div style={{
          marginTop: '4px',
          fontSize: '12px',
          color: colors.textSecondary,
          textAlign: 'right',
        }}>
          {Math.round(clampedProgress)}%
        </div>
      )}
    </div>
  );
}

