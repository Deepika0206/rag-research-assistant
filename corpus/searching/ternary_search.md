# Ternary Search

Ternary search is a divide-and-conquer algorithm that locates the extremum (minimum or maximum) of a unimodal function or searches for a value in a strictly sorted array by splitting the search interval into three equal parts.

## Mechanism and Interval Trisection

Given a range [lo, hi], two midpoints are computed: mid1 = lo + (hi - lo) / 3 and mid2 = hi - (hi - lo) / 3. For unimodal function optimization, the function values at mid1 and mid2 are compared. If f(mid1) < f(mid2), the maximum cannot reside in the leftmost segment [lo, mid1], so lo is updated to mid1. Conversely, if f(mid1) > f(mid2), the maximum cannot reside in [mid2, hi], so hi is updated to mid2.

## Complexity and Comparison to Binary Search

In each iteration, ternary search evaluates the target function at two test points and discards one-third of the search interval. The recurrence relation is T(n) = T(2n/3) + 2, yielding a time complexity of O(log3 n). While the base of the logarithm is 3, ternary search performs 2 comparisons per step (2 * log3 n ≈ 1.26 * log2 n), which requires roughly 26% more comparisons than binary search for single value lookups, but is invaluable for continuous unimodal numerical optimization.

## Boundary Conditions

The search concludes when hi - lo drops below an absolute epsilon threshold in continuous domains or when lo equals hi in discrete integral arrays.
