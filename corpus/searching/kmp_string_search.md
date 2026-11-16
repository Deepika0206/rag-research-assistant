# Knuth-Morris-Pratt Algorithm

The Knuth-Morris-Pratt (KMP) algorithm performs linear string pattern matching by exploiting structural redundancies within the search pattern. When a character mismatch occurs, it uses precomputed prefix-suffix overlap information to skip redundant character comparisons in the main text.

## Prefix Function and Failure Table

Before scanning the text, KMP builds a longest proper prefix which is also a suffix (LPS or pi table) for the pattern string of length m. The value pi[i] records the length of the longest proper prefix of pattern[0..i] that matches a suffix of pattern[0..i]. Construction of this failure array runs in O(m) time and O(m) space using a two-pointer incremental matching scan.

## Linear Text Scanning

During the text search over a stream of length n, the text pointer i never moves backwards. When text[i] mismatches pattern[j], the algorithm updates j = pi[j - 1] without resetting i. This maintains linear forward progress.

## Complexity and Invariant

Because the text index i advances monotonically from 0 to n - 1 and the pattern pointer j decrements along precomputed suffix boundaries, the total runtime is guaranteed to be strictly O(n + m) in the worst case, completely eliminating the quadratic O(n * m) worst case seen in naive pattern matching.
