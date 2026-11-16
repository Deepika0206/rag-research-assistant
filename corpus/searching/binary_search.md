# Binary Search

Binary search finds a value in a sorted array. It compares the target with the middle element. Then it throws away half of the array.

## Algorithmic Steps

Set lo to 0 and hi to the last index of the array. Compute mid as lo plus half of hi minus lo. If the target matches the value at mid, the search succeeds. If the target is smaller, move hi to mid minus one. Otherwise, move lo to mid plus one. Repeat until the boundaries cross.

## Time and Complexity Analysis

Each comparison halves the remaining search range. The runtime is strictly logarithmic O(log n) in both worst and average cases. The iterative approach uses O(1) auxiliary space, making it optimal for random-access indexed arrays.

## Invariant and Predicate Search

Beyond exact value lookups, binary search generalizes to monotonic predicate functions, such as finding the first element where condition P is true. Variants such as exponential search and interpolation search build directly on this partitioning invariant.
