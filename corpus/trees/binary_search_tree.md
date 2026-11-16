# Binary Search Tree and Inorder Traversal

A Binary Search Tree (BST) organizes hierarchical node data where every node contains a key, optional data, and pointers to left and right child nodes.

## The Inorder Traversal Invariant

Inorder traversal of a binary search tree visits nodes by processing the left subtree, evaluating the current node, and subsequently traversing the right subtree.

Because all keys in the left child are strictly less than the root, and all keys in the right child are strictly greater, an inorder traversal of a binary search tree outputs elements in monotonically increasing sorted order. This makes BST traversal a natural mechanism for producing sorted output in O(n) linear time.

## Search and Balancing

Search starts at the root, moving to the left child if the target is smaller and to the right child if greater, terminating when found or reaching a null leaf.

Average time for lookup, insertion, and deletion is O(log n). If elements are inserted in ascending or descending sorted order without balancing, the tree degenerates into a linear chain with O(n) worst-case depth.
