# Dynamic Programming Fundamentals and Fibonacci

Dynamic programming (DP) solves complex problems by breaking them down into overlapping subproblems and optimal substructure, caching intermediate results to avoid redundant exponential re-computation.

## Core Prerequisites: Subproblems and Substructure

A problem exhibits optimal substructure if an optimal solution to the global problem contains optimal solutions to its subproblems. It exhibits overlapping subproblems if a recursive algorithm revisits the same subproblems repeatedly rather than generating unique subproblems at every branch.

## Top-Down Memoization vs Bottom-Up Tabulation

Computing the n-th Fibonacci number illustrates both approaches. Pure recursion evaluates F(n) = F(n - 1) + F(n - 2) in O(2^n) time because the call tree duplicates subtrees. Top-down DP augments the recursion with an associative lookup table (memoization), reducing runtime to O(n). Bottom-up tabulation eliminates recursion entirely by filling an array from F(0) and F(1) sequentially up to F(n) in a single loop.

## Space Optimization Principle

In bottom-up tabulation, computing F(n) requires only the immediate two preceding values F(n - 1) and F(n - 2). Maintaining two scalar variables (prev1 and prev2) reduces auxiliary memory from O(n) to strict O(1) space while retaining O(n) runtime. This sliding window state reduction is a standard design pattern across DP algorithms.
