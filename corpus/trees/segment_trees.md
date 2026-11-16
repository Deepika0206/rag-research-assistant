# Segment Trees

A segment tree is a flexible tree data structure used for storing intervals or segments, enabling logarithmic range queries (such as sum, minimum, or maximum) and point or range updates over a static or dynamic array.

## Tree Structure and Construction

For an array of size n, a segment tree is represented as a binary tree where the root covers the range [0..n - 1]. Each internal node covering [L..R] splits into a left child covering [L..mid] and a right child covering [mid + 1..R], where mid = floor((L + R) / 2). The leaves represent individual array elements. Building the tree recursively takes linear O(n) time and uses at most 4n nodes in an array representation.

## Query and Update Operations

A range query [ql..qr] descends the tree: if the node interval is entirely within the query range, its precomputed aggregate is returned directly; if disjoint, an identity element is returned; otherwise, results from both children are merged. A query visits at most 4 nodes per tree level, executing in strict O(log n) time. Point updates modify a leaf and update ancestral aggregates in O(log n) time.

## Lazy Propagation for Range Updates

When updating an entire interval [ql..qr] by a value, updating individual leaves would take O(n log n). Lazy propagation defers updates: each node maintains a lazy tag. The tag is applied and pushed down to children only when those children are visited by subsequent operations. This keeps both range updates and range queries in O(log n) time.
