# Fenwick Tree

A Fenwick tree, also known as a Binary Indexed Tree (BIT), is an array-based data structure that efficiently computes prefix sums and supports point value updates in a numerical array, using less memory and simpler bitwise indexing than a segment tree.

## Bit Manipulation and Index Decomposition

A Fenwick tree stores values in an array tree of length n + 1 (using 1-based indexing). The key operation is isolating the lowest set bit of an integer i using two's complement bitwise arithmetic: lowbit(i) = i & (-i). Each index i in the tree array stores the cumulative sum of a range of length lowbit(i), specifically the interval (i - lowbit(i), i].

## Prefix Query and Point Update

To compute the prefix sum from 1 to idx, the algorithm repeatedly adds tree[idx] and strips the lowest set bit by updating idx -= idx & (-idx) until idx reaches 0. To add a delta to the element at index idx, the algorithm updates tree[idx] += delta and cascades the update upward by adding the lowest set bit: idx += idx & (-idx) while idx <= n.

## Complexity and Invariant

Because any integer up to n has at most floor(log2 n) + 1 bits set, both prefix sum queries and point updates visit at most O(log n) entries, guaranteeing O(log n) runtime. A Fenwick tree uses exactly O(n) space and requires no pointers or tree overhead, outperforming segment trees in cache locality and constant-factor speed for point-update prefix sum operations.
