/** API client for filesystem operations. */

import { TreeNode } from '../types/tree';
import { MoveRequest, MoveResponse } from '../types/moves';
import { getToken } from './auth';

const API_BASE_URL = 'http://localhost:8000';

/**
 * Get headers with authentication token if available.
 */
function getHeaders(includeAuth: boolean = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch the directory tree from the backend.
 */
export async function fetchTree(): Promise<TreeNode> {
  const response = await fetch(`${API_BASE_URL}/tree`, {
    headers: getHeaders(),
  });
  return handleResponse<TreeNode>(response);
}

/**
 * Apply file/folder move operations.
 */
export async function applyMoves(request: MoveRequest): Promise<MoveResponse> {
  const response = await fetch(`${API_BASE_URL}/apply-moves`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(request),
  });
  return handleResponse<MoveResponse>(response);
}

/**
 * Check if the backend is available.
 */
export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return handleResponse<{ status: string }>(response);
}

/**
 * Undo the last set of moves.
 */
export async function undoLastMoves(): Promise<{ success: boolean; message: string; reversed_moves: Array<{ from_path: string; to_path: string }> }> {
  const response = await fetch(`${API_BASE_URL}/undo`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(response);
}

/**
 * Check if there are moves available to undo.
 */
export async function checkUndoStatus(): Promise<{ can_undo: boolean; pending_move_sets: number }> {
  const response = await fetch(`${API_BASE_URL}/undo-status`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

/**
 * Set the root directory path for file operations.
 */
export async function setRootPath(rootPath: string): Promise<{ success: boolean; root_path: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/set-root-path`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ root_path: rootPath }),
  });
  return handleResponse(response);
}

/**
 * Organize files by their extension type.
 */
export async function organizeByFileType(rootPath?: string): Promise<{ moves: Array<{ from_path: string; to_path: string }>; organized_tree: TreeNode }> {
  const response = await fetch(`${API_BASE_URL}/organize-by-type`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ root_path: rootPath || null }),
  });
  return handleResponse(response);
}

