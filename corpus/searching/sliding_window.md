# Sliding Window Algorithm

The sliding window algorithm maintains an active subarray or substring range defined by two boundary pointers, dynamically expanding or contracting to satisfy target invariants.

## Window Types and Mechanisms

In fixed-size windows, the distance between the left and right boundary pointers remains constant, computing aggregations such as moving averages or maximum sum subarrays in linear O(n) time.

In variable-size windows, the right pointer advances to expand the window until a condition is met (such as target character frequencies), and the left pointer contracts the window to restore the invariant or minimize window size.

## Relation to Two Pointers

While both sliding window and two pointers operate on linear sequences, two pointers frequently uses inward converging boundaries on sorted arrays (e.g., meeting in the middle for two-sum), whereas sliding window typically maintains contiguous intervals with forward-moving boundaries on both sorted and unsorted sequences.
