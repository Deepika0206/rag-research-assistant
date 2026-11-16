# Rabin-Karp Algorithm

The Rabin-Karp algorithm searches for substrings by computing and comparing numeric hash values over sliding windows of the input text, using a rolling hash function to maintain linear average performance.

## Rolling Polynomial Hash

For a pattern of length m, Rabin-Karp treats the string as a base-b number modulo a large prime p: H(S) = sum(S[i] * b^(m - 1 - i)) mod p. When moving the sliding window from index k to k + 1, the new hash is computed in O(1) arithmetic operations: subtract the leading character's term, multiply by the base b, add the new trailing character, and apply modulo p.

## Collision Resolution and Complexity

When the hash of the current text window matches the hash of the pattern, an explicit character-by-character comparison verifies whether an actual match occurred, eliminating false positives caused by hash collisions. In the average case, with an appropriately large prime modulus, the number of spurious hits is negligible, yielding an expected runtime of O(n + m).

## Worst Case and Applications

If the hash function causes collisions on every candidate window, the runtime degrades to O(n * m). Rabin-Karp is especially effective for multi-pattern search, such as detecting plagiarism or searching a dictionary of keywords in a single text pass.
