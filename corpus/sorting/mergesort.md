# Merge Sort Algorithm

Merge sort is a stable divide-and-conquer sorting algorithm that splits an array into halves, sorts them recursively, and merges the sorted halves into a single ordered sequence.

## The Merge Step

The array is recursively divided at midpoint index until individual base cases containing one or zero elements remain. During the combine phase, two index pointers read from the respective sorted halves and write the smaller element into an auxiliary buffer.

When one half is exhausted, the remaining items from the other half are copied over. Because each element is compared and placed once per tree level, the merge operation runs in linear O(n) time.

## Stability and Space Complexity

Merge sort guarantees O(n log n) time complexity across best, worst, and average cases. Its tree depth is strictly logarithmic with n operations performed per level.

Unlike QuickSort, merge sort is stable, preserving the original relative order of equivalent items. Standard array implementations require O(n) auxiliary memory for combining, whereas linked-list implementations can execute without auxiliary memory allocations.
