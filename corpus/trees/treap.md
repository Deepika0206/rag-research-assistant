# Treap Data Structure

A treap (tree + heap) is a randomized binary search tree that assigns a randomly generated numerical priority to each inserted key. It maintains two structural invariants simultaneously: in-order keys satisfy binary search tree ordering, while node priorities satisfy min-heap (or max-heap) property.

## Dual Structural Invariants

For every node x in a treap:
1. BST Property: If y is in the left subtree of x, y.key < x.key. If y is in the right subtree of x, y.key > x.key.
2. Heap Property: If y is a child of x, y.priority >= x.priority.

Because priorities are drawn independently and uniformly at random from a continuous distribution, a treap has the exact same distribution of shapes as a randomized binary search tree formed by inserting keys in random order.

## Insert and Delete with Rotations

To insert key k with random priority p, the node is initially placed at the leaf position dictated by binary search tree lookup. If the new node has a smaller priority than its parent, tree rotations (left or right) lift the node upward until the heap invariant is restored. Deleting a key rotates the node downward with its lower-priority child until it becomes a leaf, where it is pruned.

## Expected Complexity

Because the expected height of a randomized search tree is strictly O(log n), search, insertion, and deletion operations all run in expected O(log n) time and O(n) space. Treaps can also be split along a key in O(log n) time and merged in O(log n) time.
