/** API client for authentication operations. */

const API_BASE_URL = 'http://localhost:8000';

export interface User {
  email: string;
  name: string;
  picture?: string;
}

export interface AuthResponse {
  valid: boolean;
  user: User | null;
}

/**
 * Get Google OAuth login URL.
 */
export function getGoogleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google`;
}

/**
 * Verify a JWT token.
 */
export async function verifyToken(token: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  return response.json();
}

/**
 * Get current user information (requires authentication).
 */
export async function getCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to get user info');
  }
  return response.json();
}

/**
 * Store JWT token in localStorage.
 */
export function storeToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * Get JWT token from localStorage.
 */
export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Remove JWT token from localStorage.
 */
export function removeToken(): void {
  localStorage.removeItem('auth_token');
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

