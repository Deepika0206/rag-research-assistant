# The 0/1 Knapsack Problem

The 0/1 knapsack problem seeks to maximize total value from a set of items subject to a weight constraint W, where each item can either be taken or left behind.

## Recurrence and Subproblems

Because greedy selection of highest value-to-weight ratio can fail on discrete items, dynamic programming stores optimal values for subproblems dp[i][w], representing the maximum value using a subset of the first i items with capacity w.

For an item with weight wt and value val, if wt exceeds w the item cannot be taken and dp[i][w] equals dp[i-1][w]. Otherwise, dp[i][w] equals the maximum between excluding the item or including it: max(dp[i-1][w], dp[i-1][w - wt] + val).

## Optimization and Complexity

The time complexity is O(N * W), which is pseudo-polynomial since it depends on the numerical value of W.

Space can be compressed to a 1D array of size W plus one by iterating backwards from capacity W down to wt, preventing the current item from being used multiple times in the same pass.
