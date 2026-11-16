# Subset Sum Problem

The subset sum problem is a fundamental decision problem in computer science: given a set of non-negative integers and a target sum S, determine whether any non-empty subset of the integers sums exactly to S.

## Dynamic Programming Boolean Table

Let dp[i][s] be a boolean indicating whether a subset of the first i elements can sum to s. Base cases: dp[i][0] = True for all i (using the empty set), and dp[0][s] = False for all s > 0. For each element num at index i and each sum s from 1 to S: if s < num, dp[i][s] = dp[i - 1][s]; otherwise, dp[i][s] = dp[i - 1][s] or dp[i - 1][s - num].

## 1D Space Optimization

Because state dp[i][s] depends only on the previous row dp[i - 1], the table can be compressed to a single boolean array of size S + 1. The inner loop over sum s must run backwards from S down to num: for num in numbers: for s from S down to num: dp[s] = dp[s] or dp[s - num]. Scanning backwards prevents using the same element multiple times, preserving the 0/1 knapsack constraint.

## Complexity and NP-Completeness

The dynamic programming algorithm runs in O(n * S) time and uses O(S) auxiliary space. Although subset sum is NP-complete, this algorithm runs in pseudo-polynomial time, making it practical when the target sum S is moderately sized.
