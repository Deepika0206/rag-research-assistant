# Heap Sort

Heap sort is a comparison-based sorting algorithm that organizes array elements into a binary heap data structure to achieve in-place sorting with optimal worst-case guarantees.

## Heap Construction and Sifting

The algorithm begins by converting an unsorted array of n elements into a max-heap. Using bottom-up heapification, sift-down operations are applied starting from the last non-leaf node (index n/2 - 1) down to the root. Building the initial max-heap runs in linear O(n) time due to converging geometric series of node heights.

## Extraction and Sorting Phase

Once the max-heap is formed, the maximum element resides at the root index 0. The algorithm swaps the root with the last element in the active heap, decreases the active heap size by one, and invokes sift-down on the new root to restore the max-heap property. Repeating this process n - 1 times leaves the entire array sorted in ascending order.

## Complexity and Stability

Heap sort runs in O(n log n) time across all best, average, and worst cases because each of the n extractions requires O(log n) sift-down steps. It operates strictly in-place with O(1) auxiliary space. However, because heap index calculations skip across distant memory locations, heap sort is not a stable sort and has poorer cache locality than quicksort.
