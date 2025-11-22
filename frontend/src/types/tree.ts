/** Type definitions for tree structure. */

export type NodeType = "file" | "folder";

export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  relative_path: string;
  size?: number;
  children?: TreeNode[];
}

