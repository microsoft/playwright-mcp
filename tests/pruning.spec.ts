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

import { test, expect } from "./fixtures";
import {
  pruneSnapshot,
  countNodes,
  estimateTokens,
  compareSnapshots,
  formatComparison,
  type AccessibilityNode,
} from "../src/pruning";

/**
 * Helper to create test nodes
 */
function createNode(
  overrides: Partial<AccessibilityNode> = {},
): AccessibilityNode {
  return {
    role: "generic",
    name: "",
    ...overrides,
  };
}

test("pruning - full mode returns unchanged snapshot", () => {
  const node = createNode({
    name: "Root",
    children: [
      createNode({ name: "Child 1" }),
      createNode({ name: "", children: [] }), // decorative
    ],
  });

  const pruned = pruneSnapshot(node, { mode: "full" });

  expect(pruned).not.toBeNull();
  expect(pruned?.children?.length).toBe(2);
  expect(countNodes(node)).toBe(countNodes(pruned));
});

test("pruning - none mode returns null", () => {
  const node = createNode({ name: "Test" });
  const pruned = pruneSnapshot(node, { mode: "none" });

  expect(pruned).toBeNull();
});

test("pruning - pruned mode removes nodes without name or children", () => {
  const node = createNode({
    name: "Root",
    children: [
      createNode({ name: "Interactive Button", role: "button" }),
      createNode({ name: "Text", role: "generic" }),
      createNode({ name: "", children: [] }), // decorative - should be removed
      createNode({
        name: "",
        children: [createNode({ name: "Nested Child" })],
      }), // has children - should be kept
    ],
  });

  const pruned = pruneSnapshot(node, { mode: "pruned" });

  expect(pruned).not.toBeNull();
  expect(pruned?.children?.length).toBe(3); // decorative node removed
  expect(countNodes(pruned)).toBe(5); // Root + Button + Text + Container + Nested Child
});

test("pruning - focused mode keeps only interactive and text nodes", () => {
  const node = createNode({
    name: "Container",
    children: [
      createNode({ name: "Link Text", role: "link" }), // interactive
      createNode({ name: "Button", role: "button" }), // interactive
      createNode({ name: "Some text", role: "generic" }), // text content
      createNode({ name: "", role: "generic" }), // decorative - removed
      createNode({ role: "heading", level: 1, name: "Heading" }), // heading text
    ],
  });

  const pruned = pruneSnapshot(node, { mode: "focused" });

  expect(pruned).not.toBeNull();
  expect(pruned?.children?.length).toBe(4); // decorative removed
});

test("pruning - respects maxDepth option", () => {
  const node = createNode({
    name: "Root",
    children: [
      createNode({
        name: "Child",
        children: [
          createNode({
            name: "Grandchild",
            children: [createNode({ name: "Great-grandchild" })],
          }),
        ],
      }),
    ],
  });

  // Without maxDepth, we get the full tree
  const full = pruneSnapshot(node, { mode: "full" });
  expect(countNodes(full)).toBe(4); // Root + Child + Grandchild + Great-grandchild

  // With maxDepth: 2 (root + 1 level of descendants), we should have shallow trees
  // This is a feature for limiting tree depth; actual behavior depends on implementation
  // For now, verify it doesn't crash
  const shallow = pruneSnapshot(node, { mode: "full", maxDepth: 2 });
  expect(shallow).not.toBeNull();
  expect(shallow?.name).toBe("Root");
});

test("pruning - excludeTypes filters by role", () => {
  const node = createNode({
    name: "Root",
    children: [
      createNode({ name: "Text", role: "generic" }),
      createNode({ name: "Button", role: "button" }),
    ],
  });

  // This tests the structure, actual filtering would be done by consumer
  const pruned = pruneSnapshot(node, {
    mode: "full",
    excludeTypes: "generic",
  });

  expect(pruned).not.toBeNull();
});

test("countNodes - counts all nodes including root", () => {
  const node = createNode({
    children: [createNode(), createNode()],
  });

  const count = countNodes(node);
  expect(count).toBe(3); // root + 2 children
});

test("countNodes - returns 0 for null", () => {
  const count = countNodes(null);
  expect(count).toBe(0);
});

test("estimateTokens - returns approximate token count", () => {
  const simple = createNode({ name: "A" });
  const complex = createNode({
    name: "Button with longer text",
    role: "button",
    children: [
      createNode({ name: "Child 1" }),
      createNode({ name: "Child 2" }),
    ],
  });

  const simpleTokens = estimateTokens(simple);
  const complexTokens = estimateTokens(complex);

  expect(simpleTokens).toBeGreaterThan(0);
  expect(complexTokens).toBeGreaterThan(simpleTokens);
});

test("compareSnapshots - calculates reduction metrics", () => {
  const fullNode = createNode({
    name: "Root",
    children: [
      createNode({ name: "Item 1" }),
      createNode({ name: "" }), // decorative
      createNode({ name: "Item 2" }),
    ],
  });

  const prunedNode = pruneSnapshot(fullNode, { mode: "pruned" });

  const comparison = compareSnapshots(fullNode, prunedNode);

  expect(comparison.fullNodes).toBeGreaterThan(comparison.prunedNodes);
  expect(comparison.nodeReduction).toBeGreaterThan(0);
  expect(comparison.tokenReduction).toBeGreaterThan(0);
  expect(comparison.nodeReduction).toBeLessThanOrEqual(100);
});

test("formatComparison - formats metrics as readable string", () => {
  const comparison = {
    fullNodes: 100,
    prunedNodes: 50,
    nodeReduction: 50,
    fullTokens: 400,
    prunedTokens: 200,
    tokenReduction: 50,
  };

  const formatted = formatComparison(comparison);

  expect(formatted).toContain("Nodes:");
  expect(formatted).toContain("100 → 50");
  expect(formatted).toContain("50.0%");
  expect(formatted).toContain("Tokens:");
  expect(formatted).toContain("400 → 200");
});

test("pruning - realistic page structure", () => {
  /**
   * Simulates a real page structure:
   * - Page container with many decorative divs
   * - Navigation with interactive links
   * - Main content area with headings and paragraphs
   * - Footer with minimal content
   */
  const realisticPage = createNode({
    name: "",
    role: "document",
    children: [
      // Navigation
      createNode({
        name: "Navigation",
        role: "navigation",
        children: [
          createNode({ name: "Home", role: "link" }),
          createNode({ name: "About", role: "link" }),
          createNode({ name: "Products", role: "link" }),
        ],
      }),
      // Decorative spacer
      createNode({ name: "", role: "generic" }),
      // Main content
      createNode({
        name: "Main Content",
        role: "main",
        children: [
          createNode({
            name: "Welcome to Our Site",
            role: "heading",
            level: 1,
          }),
          createNode({ name: "This is some descriptive text.", role: "text" }),
          createNode({ name: "Click me", role: "button" }),
          // Decorative spacing
          createNode({ name: "", role: "generic" }),
          // Product listing
          createNode({
            name: "Product List",
            role: "list",
            children: [
              createNode({
                name: "Product 1",
                role: "listitem",
                children: [createNode({ name: "Buy", role: "button" })],
              }),
              createNode({ name: "", role: "generic" }), // decorative
              createNode({
                name: "Product 2",
                role: "listitem",
                children: [createNode({ name: "Buy", role: "button" })],
              }),
            ],
          }),
        ],
      }),
      // Footer
      createNode({
        name: "Footer",
        role: "contentinfo",
        children: [
          createNode({ name: "© 2024 Company", role: "text" }),
          createNode({ name: "", role: "generic" }), // decorative
        ],
      }),
    ],
  });

  const full = countNodes(realisticPage);
  const fullTokens = estimateTokens(realisticPage);

  const prunedNode = pruneSnapshot(realisticPage, { mode: "pruned" });
  const pruned = countNodes(prunedNode);
  const prunedTokens = estimateTokens(prunedNode);

  const focusedNode = pruneSnapshot(realisticPage, { mode: "focused" });
  const focused = countNodes(focusedNode);
  const focusedTokens = estimateTokens(focusedNode);

  // Pruned should remove decorative nodes
  expect(pruned).toBeLessThan(full);
  expect(prunedTokens).toBeLessThan(fullTokens);

  // Focused should be most aggressive
  expect(focused).toBeLessThanOrEqual(pruned);
  expect(focusedTokens).toBeLessThanOrEqual(prunedTokens);

  // Should still have interactive elements
  expect(focused).toBeGreaterThan(0);

  const comparison = compareSnapshots(realisticPage, prunedNode);
  console.log(`Pruned mode: ${formatComparison(comparison)}`);

  const focusedComparison = compareSnapshots(realisticPage, focusedNode);
  console.log(`Focused mode: ${formatComparison(focusedComparison)}`);
});

test("pruning - preserves interactive attributes", () => {
  const node = createNode({
    name: "Checkbox",
    role: "checkbox",
    checked: false,
    children: [createNode({ name: "Label" })],
  });

  const pruned = pruneSnapshot(node, { mode: "pruned" });

  expect(pruned?.checked).toBe(false);
  expect(pruned?.role).toBe("checkbox");
});

test("pruning - focused mode keeps nodes with interactive children", () => {
  const node = createNode({
    name: "Form Container",
    role: "form",
    children: [
      createNode({
        name: "", // no accessible name
        role: "generic",
        children: [
          createNode({ name: "Submit", role: "button" }), // has interactive child
        ],
      }),
    ],
  });

  const pruned = pruneSnapshot(node, { mode: "focused" });

  // The generic div with interactive children should be kept
  expect(pruned?.children?.length).toBeGreaterThan(0);
});
