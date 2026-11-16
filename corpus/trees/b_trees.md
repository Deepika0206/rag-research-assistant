# B-Trees

A B-tree is a self-balancing search tree data structure designed for disk storage systems, databases, and filesystems where read and write operations occur in large blocks of pages rather than individual memory words.

## Multi-Way Node Branching and Invariants

Unlike binary trees where each node has at most two children, a B-tree of order m (or minimum degree t >= 2) allows nodes to contain multiple keys and child pointers:
1. Every node has at most m children (or 2t - 1 keys).
2. Every internal node (except the root) has at least ceil(m / 2) children (or t - 1 keys).
3. The root has at least 2 children if it is not a leaf.
4. A non-leaf node with k children contains exactly k - 1 sorted keys that act as partition separators for its child subtrees.
5. All leaf nodes appear at the exact same depth, maintaining strict balance.

## Disk Access Minimization

Because disk I/O operations are thousands of times slower than main memory accesses, B-tree nodes are sized to match the physical page or block size of the underlying storage hardware (typically 4 KB to 64 KB). Large branching factors (e.g., m = 1000) keep the tree height exceptionally shallow; a tree of height 3 can index billions of records.

## Complexity Bounds

Search, insertion, and deletion all take O(log_m n) disk access operations and O(m * log_m n) in-memory comparison operations. In B+ tree variants, all user data records are stored exclusively in linked leaf nodes, while internal nodes store only index keys, further maximizing branching factor and sequential scan performance.
