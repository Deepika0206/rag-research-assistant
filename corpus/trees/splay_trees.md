# Splay Trees

A splay tree is a self-adjusting binary search tree with the distinctive property that recently accessed elements are quick to access again. After every lookup, insertion, or deletion, the accessed node is moved to the root of the tree using a sequence of rotations called splaying.

## Splaying Rotations

The splay operation repeatedly examines the target node x, its parent p, and its grandparent g:
1. Zig step: If p is the root, a single rotation on the edge between x and p moves x to the root.
2. Zig-Zig step: If x and p are both left children or both right children, the algorithm first rotates the edge between p and g, and then rotates the edge between x and p. Performing the rotations in this specific order halves the tree depth.
3. Zig-Zag step: If x is a right child and p is a left child (or vice versa), the algorithm rotates the edge between x and p, and then rotates between x and the new parent.

## Amortized Complexity Analysis

Using the potential method with potential function Phi equal to the sum of logarithms of subtree sizes, it is proved that any sequence of m operations on an n-node splay tree takes O(m log n) total time. Thus, the amortized time complexity per operation is strictly O(log n).

## Cache Optimization and Working Set

Splay trees require no balance factors, color bits, or height fields at nodes, making them memory efficient. They satisfy the Working Set Theorem: accessing an item from a working set of size k takes amortized O(log k) time, making splay trees optimal for caching and memory allocators.
