# Lowest Common Ancestor and Binary Lifting

The Lowest Common Ancestor (LCA) of two nodes u and v in a rooted tree is the deepest node that is an ancestor of both u and v. Finding LCAs is a central problem in graph theory, network routing, and phylogenetic tree analysis.

## Binary Lifting Table and Preprocessing

Binary lifting is a dynamic programming technique on trees that precomputes ancestors at powers-of-two heights. Let up[node][i] be the 2^i-th ancestor of node. The recurrence relation is up[node][i] = up[up[node][i - 1]][i - 1], with base case up[node][0] = parent[node]. During an initial Depth-First Search traversal, tree depths and ancestor tables up[node][0..ceil(log2 n)] are populated in O(n log n) preprocessing time and O(n log n) space.

## Query Execution in Logarithmic Time

To find LCA(u, v):
1. Equalize depths: if depth[u] < depth[v], swap u and v. Jump u upwards to the same depth as v by decomposing the depth difference into binary powers.
2. Check equality: if u == v after depth equalization, v was already an ancestor of u, so return v.
3. Synchronous lifting: iterate step i from floor(log2 n) down to 0. If up[u][i] != up[v][i], both u and v can jump 2^i steps upwards together without overshooting the LCA.
4. Terminal step: after the loop terminates, u and v are direct children of the LCA, so return up[u][0].

## Complexity Guarantees

Binary lifting answers each subsequent LCA query in strict O(log n) worst-case time without mutating the tree. It readily extends to path queries such as finding maximum edge weights or sum aggregates along tree paths in O(log n) time.
