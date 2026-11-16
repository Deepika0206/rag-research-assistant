# Two Pointers Technique

The two pointers technique uses two indices traversing a linear collection to evaluate conditions without quadratic nested loops.

## Inward Converging Pointers

For sorted collections, opposing pointers begin at index zero and the tail index. To evaluate whether two elements sum to a target, we compute their sum. If the sum is smaller than the target, incrementing the left pointer increases the total. If the sum exceeds the target, decrementing the right pointer decreases it.

This inward convergence processes the entire sorted array in O(n) linear time with O(1) auxiliary space, replacing nested search iterations.

## Sliding Window and Fast-Slow Pointers

In the forward-moving variation, both pointers start at the front. The leading pointer extends a candidate window to satisfy a constraint, while the trailing pointer contracts the window to minimize length or maintain invariants. In linked lists, Floyd cycle-finding uses two pointers moving at different speeds to detect loops in linear time without additional memory.
