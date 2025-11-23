/** Login screen component with Google SSO. */

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getGoogleLoginUrl, verifyToken, storeToken, getToken } from '../api/auth';

// Extend Window interface for Electron API
declare global {
  interface Window {
    electronAPI?: {
      openExternal: (url: string) => void;
    };
  }
}

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { colors, theme, toggleTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for token in URL (from OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      handleTokenCallback(token);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Check for existing token on mount
  // Note: We skip auto-login on the login screen to force fresh authentication
  // This allows users to switch accounts
  useEffect(() => {
    // Only auto-login if there's a token in the URL (from OAuth callback)
    // Don't auto-login from localStorage on the login screen
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
      // Clear any existing token to force fresh login
      const existingToken = getToken();
      if (existingToken) {
        // Remove token to ensure fresh authentication
        localStorage.removeItem('auth_token');
      }
    }
  }, []);

  const handleTokenCallback = async (token: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await verifyToken(token);
      if (result.valid && result.user) {
        storeToken(token);
        onLoginSuccess(token);
      } else {
        setError('Invalid token received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError(null);
    
    // Open Google OAuth in current window (for Electron, this will open browser)
    const loginUrl = getGoogleLoginUrl();
    
    // For Electron, we might need to use a different approach
    // For web, we can redirect directly
    if (window.electronAPI) {
      // Electron: open in external browser
      window.electronAPI.openExternal(loginUrl);
    } else {
      // Web: redirect to login
      window.location.href = loginUrl;
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      color: colors.text,
      padding: '40px',
    }}>
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: `0 8px 32px ${colors.shadowHover}`,
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '32px',
            fontWeight: '700',
            color: colors.text,
          }}>
            dOrg
          </h1>
          <p style={{
            margin: '0',
            fontSize: '16px',
            color: colors.textSecondary,
          }}>
            File Organization Tool
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: colors.errorBackground,
            color: colors.error,
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px',
            border: `1px solid ${colors.error}`,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            backgroundColor: isLoading ? colors.border : '#4285F4',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'all 0.2s ease',
            boxShadow: isLoading ? 'none' : `0 2px 8px rgba(66, 133, 244, 0.3)`,
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#357AE8';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#4285F4';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(66, 133, 244, 0.3)';
            }
          }}
        >
          {isLoading ? (
            <>
              <span style={{ fontSize: '18px' }}>⏳</span>
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <p style={{
          marginTop: '24px',
          fontSize: '12px',
          color: colors.textSecondary,
          textAlign: 'center',
          lineHeight: '1.5',
        }}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
          <br />
          Your files remain on your device and are never uploaded to our servers.
        </p>
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          padding: '10px',
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          backgroundColor: colors.surface,
          color: colors.text,
          cursor: 'pointer',
          fontSize: '20px',
        }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}

