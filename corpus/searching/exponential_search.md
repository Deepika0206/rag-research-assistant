# Exponential Search

Exponential search finds a target value in an unbounded or sorted array by identifying a bounded range and then executing a standard binary search within that range. It is especially effective when searching arrays of unknown size or when the target element is near the beginning of the collection.

## Algorithmic Range Doubling

The algorithm begins by checking whether the target resides at index 0. If not, it initializes an index pointer to 1 and repeatedly doubles the index (1, 2, 4, 8, 16, ...) until the element at the current index is greater than or equal to the target or the upper bound of the array is exceeded. Once the bounding interval [index/2, min(index, n - 1)] is determined, binary search is called over that sub-array.

## Time and Complexity Analysis

The range-bounding phase executes in O(log i) steps, where i is the index position of the target element. The subsequent binary search across an interval of length at most i also takes O(log i) comparisons. Consequently, exponential search runs in O(log i) time and O(1) auxiliary space, which strictly outperforms standard binary search when i is much smaller than the total length n.

## Practical Applications

Exponential search is standard in streaming architectures, memory-mapped files, and unbounded data sources where length queries are costly or impossible. It bridges unbounded step-skipping with logarithmic divide-and-conquer precision.
