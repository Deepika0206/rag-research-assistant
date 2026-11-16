# Radix Sort

Radix sort is a non-comparative sorting algorithm that sorts multi-digit numbers or fixed-length strings by processing individual digit representations from least significant digit (LSD) to most significant digit (MSD) using a stable sub-sorting algorithm.

## LSD Radix Sort Mechanics

Least Significant Digit (LSD) radix sort begins at digit position 0 (the least significant digit). For each digit up to position d - 1, it groups and sorts the keys using a stable sub-sort, typically counting sort with radix base b (such as b = 10 for decimal or b = 256 for byte words). Stability in the sub-sort is mandatory so that equal digits at step i preserve the sorted order established by step i - 1.

## Complexity Formulation

If keys have d digits in base b, radix sort executes d rounds of counting sort. Each counting sort pass takes O(n + b) time. Therefore, the total time complexity is strictly O(d * (n + b)) with O(n + b) space. When d is a constant and b = O(n), radix sort runs in linear O(n) time.

## MSD vs LSD Trade-Offs

While LSD sorts from right to left in a non-recursive loop, Most Significant Digit (MSD) radix sort starts at the highest-order digit and recursively partitions elements into sub-buckets. MSD is suitable for variable-length strings and early termination, but incurs additional recursive call stack overhead.
