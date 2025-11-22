/** Type definitions for move operations. */

export interface MoveItem {
  from_path: string;
  to_path: string;
}

export interface MoveResultItem {
  from_path: string;
  to_path: string;
  status: string;
  reason?: string;
}

export interface MoveRequest {
  moves: MoveItem[];
  dry_run?: boolean;
}

export interface MoveResponse {
  dry_run: boolean;
  results: MoveResultItem[];
}

