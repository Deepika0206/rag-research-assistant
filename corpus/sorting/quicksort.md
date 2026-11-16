# QuickSort Algorithm

QuickSort is an efficient comparison-based divide-and-conquer sorting algorithm. It selects a pivot value and partitions all remaining elements into values strictly less than the pivot and values greater than or equal to it.

## Partitioning Approaches

Lomuto partitioning maintains a boundary pointer and scans from left to right, swapping smaller items into position. Hoare partitioning uses two pointers scanning inward from both ends, executing fewer swaps and coping better with identical keys.

Modern sorting implementations often adopt dual-pivot partitioning. By using two pivots P1 and P2, the input is partitioned into three segments, yielding fewer comparisons and enhanced CPU cache performance.

## Complexity Bounds

Average-case time complexity is O(n log n). However, if pivot selection consistently isolates extreme elements, recursion depth degenerates to n, producing a worst-case time of O(n^2).

Randomized pivot choice or the median-of-three heuristic protects against worst-case degradation on presorted data. QuickSort requires O(log n) auxiliary stack space and sorts in-place.
