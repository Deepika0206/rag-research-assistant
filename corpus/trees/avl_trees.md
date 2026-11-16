# AVL Trees and Balancing Rotations

An AVL tree is a height-balanced binary search tree that maintains logarithmic lookup depth under insertions and deletions.

## Height Balance Factor

The balance factor of a node is calculated as the height of its left subtree minus the height of its right subtree. An AVL tree requires that the balance factor of every node stays within {-1, 0, +1}.

If an insertion or deletion pushes any node balance factor to plus two or minus two, tree rotations restore balance in O(1) time per affected node, guaranteeing maximum height proportional to 1.44 log n.

## Types of Tree Rotations

Single rotations handle monotonic imbalances: Right Rotation fixes Left-Left imbalance, and Left Rotation fixes Right-Right imbalance.

Double rotations resolve zig-zag imbalances: Left-Right rotation applies a Left Rotation to the child followed by a Right Rotation to the root; Right-Left applies a Right Rotation to the child followed by a Left Rotation to the root.
