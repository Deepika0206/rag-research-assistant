# Bubble Sort

Bubble sort is an elementary comparison sorting algorithm that repeatedly steps through an array, compares adjacent elements, and swaps them if they are in the wrong order until no further swaps are required.

## Pass Mechanics and Bubbling

During each pass over the array of length n, the pointer iterates from index 0 to n - 2. When arr[i] > arr[i + 1], the pair is swapped. Consequently, the largest unsorted element floats or bubbles to its correct terminal position at the end of the active prefix. With each completed pass, the required scanning range decreases by one.

## Optimization with Early Stopping

A naive implementation always executes n - 1 passes, performing exactly n*(n - 1)/2 comparisons. An optimized variant tracks a boolean swapped flag during each iteration. If an entire pass completes without a single swap, the array is verified to be fully ordered and the algorithm halts immediately. This yields an optimal best-case runtime of O(n) for already sorted arrays.

## Worst-Case Complexity and Stability

In the worst case (reverse-ordered array), bubble sort performs O(n^2) comparisons and O(n^2) swaps. Because equal adjacent items are never exchanged, bubble sort is inherently stable. It operates in-place using O(1) auxiliary space, serving primarily as a pedagogical tool in introductory algorithm design.
