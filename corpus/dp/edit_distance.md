# Edit Distance

Edit distance, commonly computed as Levenshtein distance, quantifies how dissimilar two strings word1 and word2 are by finding the minimum number of single-character operations (insertions, deletions, and substitutions) required to transform word1 into word2.

## Recurrence Formulation

Let dp[i][j] denote the minimum edit operations required to convert word1[0..i - 1] into word2[0..j - 1]. The base cases are dp[i][0] = i (deleting all characters of word1) and dp[0][j] = j (inserting all characters of word2). If word1[i - 1] == word2[j - 1], the characters match without extra cost: dp[i][j] = dp[i - 1][j - 1]. Otherwise, dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]), representing deletion, insertion, and substitution respectively.

## Time and Space Complexity

Computing the table for strings of length m and n evaluates m * n subproblems in O(m * n) time. While the full 2D table uses O(m * n) space, observing that row i depends solely on row i - 1 allows memory compression to O(min(m, n)) space using two alternating 1D arrays.

## Applications

Edit distance is widely applied in spell checking, bioinformatics for DNA and amino acid sequence alignment (such as the Needleman-Wunsch algorithm), natural language processing, and version control difference engines.
