# Longest Common Subsequence and Memoization

The Longest Common Subsequence (LCS) finds the longest subsequence present in both strings in relative order without requiring elements to be consecutive.

## What is Memoization in Dynamic Programming

Memoization is an optimization technique that speeds up recursive algorithms by caching the results of expensive function calls. When an identical subproblem with the same parameters is encountered again, the memoized value is looked up in O(1) time rather than recalculating the entire subtree.

In LCS, a naive recursion branches exponentially to O(2^(n+m)) due to heavily overlapping subproblems. Memoizing results in a lookup table reduces the execution time to O(n * m), turning an intractable problem into a polynomial one.

## Tabular Construction and Recovery

In bottom-up dynamic programming, a 2D matrix dp of size (n+1) by (m+1) is filled iteratively. If characters match, dp[i][j] = dp[i-1][j-1] + 1. If they differ, dp[i][j] takes the maximum of dp[i-1][j] and dp[i][j-1].

The final length resides at dp[n][m]. The actual sequence can be reconstructed by backtracking through the matrix from the bottom-right corner following matching cell transitions.
