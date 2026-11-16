# Coin Change Problem

The coin change problem is a classic optimization problem with two standard formulations: finding the minimum number of coins needed to make a target amount (unbounded knapsack), and counting the total number of distinct coin combinations that sum to the target amount.

## Minimum Coins Recurrence

Given coin denominations c1, c2, ..., cn and target amount W, let dp[w] represent the minimum coins needed to sum to w. Base case: dp[0] = 0; all other values are initialized to infinity. For each amount w from 1 to W and each coin c, if w >= c, the recurrence evaluates: dp[w] = min(dp[w], dp[w - c] + 1). If dp[W] remains infinity after iterating, the amount cannot be formed.

## Counting Combinations vs Permutations

To count distinct combinations without duplicates, the outer loop must iterate over coins, while the inner loop iterates over amounts: for coin in coins: for w from coin to W: ways[w] += ways[w - coin]. Inverting the loop order (outer loop over amounts) counts permutations instead of unordered combinations.

## Complexity Bounds

The space-optimized 1D array approach runs in O(n * W) time, where n is the number of coin denominations and W is the target amount. The auxiliary space requirement is strictly O(W). Because runtime depends on the numeric value of W rather than its bit-length, coin change is a pseudo-polynomial dynamic programming algorithm.
