# Selection Sort

Selection sort is an in-place comparison sort that divides the input array into a sorted prefix and an unsorted suffix, repeatedly finding the minimum element from the unsorted section and appending it to the sorted prefix.

## Selection Algorithm

For each index i from 0 to n - 2, selection sort scans all remaining positions from i + 1 to n - 1 to identify the index of the minimum element, min_idx. After the scan finishes, arr[i] and arr[min_idx] are swapped. This guarantees that after step i, the first i + 1 positions contain the i + 1 smallest elements in sorted order.

## Strict Quadratic Comparisons

Because the scanning step must examine every remaining unsorted position to locate the minimum, selection sort always performs (n - 1) + (n - 2) + ... + 1 = n*(n - 1)/2 comparisons, regardless of whether the initial array is sorted, reverse sorted, or random. Thus, the best, average, and worst-case time complexities are all strictly Theta(n^2).

## Minimal Swap Property and Stability

Although selection sort has quadratic comparison cost, it performs at most n - 1 total swaps across its entire execution, which is strictly O(n) memory writes. This makes selection sort advantageous in flash memory or EEPROM devices where write cycles are physically costly. Standard array selection sort is unstable because long-distance swaps can reorder identical elements.
