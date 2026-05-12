/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Represents a node in the accessibility tree.
 */
export interface AccessibilityNode {
  role?: string;
  name?: string;
  value?: string;
  description?: string;
  pressed?: boolean | "mixed";
  checked?: boolean | "mixed";
  selected?: boolean;
  expanded?: boolean;
  level?: number;
  disabled?: boolean;
  hidden?: boolean;
  live?: string;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  children?: AccessibilityNode[];
  [key: string]: any;
}

/**
 * Snapshot pruning strategies for accessibility trees.
 */
export type SnapshotMode = "full" | "pruned" | "focused" | "none";

/**
 * Configuration for snapshot pruning.
 */
export interface PruningOptions {
  /**
   * The pruning mode to apply.
   */
  mode?: SnapshotMode;

  /**
   * Maximum depth of the accessibility tree (undefined = no limit).
   */
  maxDepth?: number;

  /**
   * Node types to exclude (comma-separated list or Set).
   */
  excludeTypes?: string | Set<string>;

  /**
   * Logger function for debugging.
   */
  logger?: (message: string) => void;
}

/**
 * Interactive roles that should always be kept in focused mode.
 */
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "checkbox",
  "radio",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "tabpanel",
  "combobox",
  "listbox",
  "option",
  "spinbutton",
  "slider",
  "switch",
  "form",
  "heading",
  "img",
  "dialog",
  "alertdialog",
  "alert",
  "select",
  "navigation",
  "main",
  "region",
  "article",
  "definition",
  "list",
  "listitem",
  "table",
  "row",
  "columnheader",
  "rowheader",
  "cell",
  "document",
  "application",
]);

/**
 * Determines if a node is interactive (has actionable role or attributes).
 */
function isInteractive(node: AccessibilityNode): boolean {
  if (!node) return false;

  // Check if role is interactive
  if (node.role && INTERACTIVE_ROLES.has(node.role)) {
    return true;
  }

  // Check for interactive attributes
  if (
    node.checked !== undefined ||
    node.selected !== undefined ||
    node.pressed !== undefined ||
    node.expanded !== undefined
  ) {
    return true;
  }

  // Links and buttons
  if (
    (node.role && (node.role === "link" || node.role === "button")) ||
    node.onclick
  ) {
    return true;
  }

  return false;
}

/**
 * Determines if a node has an accessible name.
 */
function hasAccessibleName(node: AccessibilityNode): boolean {
  return Boolean(node.name && node.name.trim().length > 0);
}

/**
 * Determines if a node should be kept in pruned mode.
 * A node is kept if it has an accessible name OR has children.
 */
function shouldKeepPruned(node: AccessibilityNode): boolean {
  return hasAccessibleName(node) || (node.children && node.children.length > 0);
}

/**
 * Determines if a node should be kept in focused mode.
 * Keep only interactive elements and text/content nodes.
 */
function shouldKeepFocused(node: AccessibilityNode): boolean {
  if (!node) return false;

  // Always keep interactive elements
  if (isInteractive(node)) return true;

  // Keep nodes with text content (role="none" with name)
  if (hasAccessibleName(node)) return true;

  // Keep text-like roles
  const textRoles = ["heading", "listitem", "definition", "cell"];
  if (node.role && textRoles.includes(node.role)) return true;

  // Keep if has interactive children
  if (node.children && node.children.length > 0) {
    return node.children.some(isInteractive);
  }

  return false;
}

/**
 * Recursively prunes a node and its children.
 * Returns null if the node should be completely removed.
 */
function pruneNodeRecursive(
  node: AccessibilityNode | null,
  options: PruningOptions,
  currentDepth: number = 0,
): AccessibilityNode | null {
  if (!node) return null;

  // Check depth limit - if we've reached max depth, don't include children
  if (options.maxDepth !== undefined && currentDepth >= options.maxDepth) {
    return {
      ...node,
      children: undefined,
    };
  }

  // Recursively prune children only if we haven't exceeded depth limit
  let children = node.children;
  if (children && children.length > 0) {
    // For the next level, check if we'd exceed the depth
    const nextDepth = currentDepth + 1;
    if (options.maxDepth === undefined || nextDepth < options.maxDepth) {
      children = children
        .map((child) => pruneNodeRecursive(child, options, nextDepth))
        .filter((child): child is AccessibilityNode => child !== null);
    } else {
      // At max depth - don't include children
      children = undefined;
    }
  }

  const prunedNode: AccessibilityNode = {
    ...node,
    children: children && children.length > 0 ? children : undefined,
  };

  // Apply mode-specific filtering
  if (options.mode === "pruned") {
    if (!shouldKeepPruned(prunedNode)) {
      return null;
    }
  } else if (options.mode === "focused") {
    if (!shouldKeepFocused(prunedNode)) {
      return null;
    }
  }

  return prunedNode;
}

/**
 * Prunes an accessibility tree node based on the specified mode.
 *
 * @param node The root accessibility node to prune
 * @param options Pruning configuration
 * @returns The pruned node, or null if completely removed
 *
 * @example
 * ```ts
 * const pruned = pruneSnapshot(fullTree, {
 *   mode: 'pruned',
 *   maxDepth: 4,
 *   excludeTypes: 'generic,none',
 * });
 * ```
 */
export function pruneSnapshot(
  node: AccessibilityNode | null,
  options: PruningOptions = {},
): AccessibilityNode | null {
  if (!node) return null;

  // No pruning for "full" mode
  if (!options.mode || options.mode === "full") {
    return node;
  }

  // Return null for "none" mode
  if (options.mode === "none") {
    return null;
  }

  // Parse excludeTypes if it's a string
  const excludeTypes =
    typeof options.excludeTypes === "string"
      ? new Set(
          options.excludeTypes
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        )
      : options.excludeTypes || new Set();

  const pruningOptions: PruningOptions = {
    ...options,
    excludeTypes,
  };

  return pruneNodeRecursive(node, pruningOptions);
}

/**
 * Counts nodes in an accessibility tree for comparison metrics.
 */
export function countNodes(
  node: AccessibilityNode | null,
  _options: PruningOptions = {},
): number {
  if (!node) return 0;

  let count = 1;
  if (node.children && node.children.length > 0) {
    count += node.children.reduce(
      (sum, child) => sum + countNodes(child, _options),
      0,
    );
  }
  return count;
}

/**
 * Estimates token count for a snapshot based on JSON serialization.
 * This is a rough approximation using character count / 4.
 */
export function estimateTokens(node: AccessibilityNode | null): number {
  if (!node) return 0;

  const jsonStr = JSON.stringify(node);
  // Rough estimate: ~4 characters per token (varies by tokenizer)
  return Math.ceil(jsonStr.length / 4);
}

/**
 * Compares two snapshots and returns metrics.
 */
export interface SnapshotComparison {
  fullNodes: number;
  prunedNodes: number;
  nodeReduction: number; // percentage
  fullTokens: number;
  prunedTokens: number;
  tokenReduction: number; // percentage
}

/**
 * Compares pruning effectiveness between full and pruned snapshots.
 */
export function compareSnapshots(
  fullNode: AccessibilityNode | null,
  prunedNode: AccessibilityNode | null,
): SnapshotComparison {
  const fullNodes = countNodes(fullNode);
  const prunedNodes = countNodes(prunedNode);
  const fullTokens = estimateTokens(fullNode);
  const prunedTokens = estimateTokens(prunedNode);

  const nodeReduction =
    fullNodes > 0 ? ((fullNodes - prunedNodes) / fullNodes) * 100 : 0;
  const tokenReduction =
    fullTokens > 0 ? ((fullTokens - prunedTokens) / fullTokens) * 100 : 0;

  return {
    fullNodes,
    prunedNodes,
    nodeReduction,
    fullTokens,
    prunedTokens,
    tokenReduction,
  };
}

/**
 * Formats comparison metrics as a human-readable string.
 */
export function formatComparison(comparison: SnapshotComparison): string {
  return [
    `Nodes: ${comparison.fullNodes} → ${comparison.prunedNodes} (-${comparison.nodeReduction.toFixed(1)}%)`,
    `Tokens: ${comparison.fullTokens} → ${comparison.prunedTokens} (-${comparison.tokenReduction.toFixed(1)}%)`,
  ].join(" | ");
}
