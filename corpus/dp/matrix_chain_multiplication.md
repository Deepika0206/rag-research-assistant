# Matrix Chain Multiplication

Matrix chain multiplication is an interval dynamic programming problem that determines the most efficient order to multiply a sequence of matrices, minimizing the total number of scalar multiplications without changing the matrix operands.

## Parenthesization and Recurrence Relation

Given n matrices A1, A2, ..., An with dimensions p0 x p1, p1 x p2, ..., p(n-1) x pn, matrix multiplication is associative but not commutative. Let m[i][j] denote the minimum scalar operations needed to compute the matrix product Ai...Aj. If i == j, the cost is 0. For i < j, the recurrence splits at intermediate index k: m[i][j] = min(m[i][k] + m[k + 1][j] + p(i - 1) * p(k) * p(j)) for all k from i to j - 1.

## Tabulation by Chain Length

A naive brute-force search over all possible parenthesizations explores Catalan number C(n - 1) = Omega(4^n / n^(3/2)) combinations. The dynamic programming approach fills the table by increasing chain length L from 2 up to n. For each chain length, it iterates through valid starting indices i and evaluates all split positions k.

## Time and Space Complexity

Filling an n x n table where each entry considers up to O(n) split positions requires O(n^3) time and O(n^2) space. An auxiliary table s[i][j] records the optimal split index k, enabling the reconstruction of the full parenthesized algebraic expression in O(n) time.
