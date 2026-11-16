# Rod Cutting

The rod cutting problem involves finding the maximum revenue obtainable by cutting a rod of length n into smaller integer pieces and selling each piece according to a given price table p[1..n].

## Optimal Substructure and Recurrence

A rod of length i can be sold as a single piece or divided into a first piece of length j (1 <= j <= i) and a remainder of length i - j. The maximum revenue r[i] satisfies the optimal substructure relation: r[i] = max(p[j] + r[i - j] for j from 1 to i), with base case r[0] = 0.

## Top-Down Memoization vs Bottom-Up Tabulation

A naive recursive implementation evaluates identical subproblems repeatedly, requiring O(2^n) exponential time. Top-down dynamic programming stores computed values in an auxiliary memoization array. Bottom-up tabulation iteratively solves subproblems in increasing length order from 1 to n, filling an array revenue[1..n] sequentially.

## Complexity and Solution Reconstruction

Bottom-up tabulation evaluates sum(i for i=1 to n) = n*(n + 1)/2 transitions, executing in O(n^2) time with O(n) space. By maintaining an auxiliary array split[i] that records the optimal cut length j chosen for rod length i, the exact cutting decisions can be reconstructed in O(n) time.
