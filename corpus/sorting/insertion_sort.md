# Insertion Sort

Insertion sort is an intuitive, comparison-based sorting algorithm that constructs the final sorted sequence one element at a time, closely resembling the way a player arranges playing cards in hand.

## Shifting and Insertion Invariant

The algorithm maintains a sorted prefix of elements. For each index i from 1 to n - 1, the value at arr[i] is extracted into a temporary variable key. The algorithm then scans backwards through the sorted sub-array [0..i - 1], shifting elements greater than key one position to the right. As soon as an element less than or equal to key is reached, key is dropped into the newly opened slot.

## Complexity and Adaptivity

In the worst case (reverse-sorted array) and average case, insertion sort performs sum(i for i=1 to n-1) = n*(n-1)/2 comparisons and shifts, yielding O(n^2) runtime. Crucially, when the input array is already sorted or nearly sorted with k inversions, inner loop shifts terminate immediately, resulting in O(n + k) adaptive linear-time performance.

## Space, Stability, and Usage

Insertion sort is an in-place algorithm using O(1) auxiliary memory. It is strictly stable because equal elements are never shifted past each other. Due to its minimal overhead, it is universally chosen as the base-case sorting routine in hybrid algorithms like Timsort and Introsort for partitions smaller than 16 to 32 elements.
