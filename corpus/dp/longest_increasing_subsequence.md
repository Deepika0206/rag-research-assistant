# Longest Increasing Subsequence

The Longest Increasing Subsequence (LIS) problem finds the length of the longest subsequence of a given sequence such that all elements of the subsequence are sorted in strictly increasing order.

## Quadratic Dynamic Programming

In the standard dynamic programming formulation, dp[i] represents the length of the longest increasing subsequence ending at index i. Initially, dp[i] = 1 for all i. For each i from 1 to n - 1 and j from 0 to i - 1, if arr[j] < arr[i], dp[i] is updated to max(dp[i], dp[j] + 1). The answer is max(dp[i] for 0 <= i < n). This approach runs in O(n^2) time and requires O(n) space.

## Logarithmic Patience Sorting Formulation

The algorithm can be accelerated to O(n log n) time using patience sorting and binary search. It maintains an array tails, where tails[len - 1] stores the smallest tail element of all increasing subsequences of length len discovered so far. For each element x in arr, binary search (bisect_left) identifies the insertion point idx in tails.

## Update Invariant and Complexity

If idx equals the length of tails, x extends the longest subsequence found so far, so x is appended to tails. Otherwise, tails[idx] is replaced with x because a smaller tail improves the potential to extend the subsequence later. Processing n elements with O(log n) binary search lookups gives an optimal runtime of O(n log n) and O(n) space.
