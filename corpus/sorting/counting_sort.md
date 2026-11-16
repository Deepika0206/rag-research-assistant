# Counting Sort

Counting sort is a non-comparison integer sorting algorithm that operates in linear time when the range of input keys, k, is not significantly larger than the number of elements, n.

## Histogram and Prefix Accumulation

Counting sort constructs an auxiliary frequency array count of size k, initialized to zeros. In the first pass over the n input elements, it increments count[arr[i]]. In the second pass, it computes prefix sums across the count array so that count[v] stores the exact number of elements less than or equal to value v.

## Stable Placement in Output Array

To place items into the output array, the algorithm scans the input array backwards from index n - 1 down to 0. For each item val, it places val into output[count[val] - 1] and decrements count[val]. Scanning in reverse order guarantees that elements with identical values preserve their initial relative positions, making counting sort strictly stable.

## Complexity Bounds and Restrictions

Counting sort runs in O(n + k) time and uses O(n + k) auxiliary memory. When k = O(n), counting sort executes in linear O(n) time, breaking the Omega(n log n) comparison-based sorting lower bound. However, if k is exponentially larger than n, memory and initialization overhead render it impractical.
