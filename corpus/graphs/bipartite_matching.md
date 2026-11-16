# Bipartite Matching

Bipartite matching finds the maximum set of edges in a bipartite graph such that no two edges share a common vertex. A graph is bipartite if its vertices can be partitioned into two disjoint independent sets, U and V, such that every edge connects a vertex in U to a vertex in V.

## Alternating and Augmenting Paths

An edge is matched if it belongs to the current matching M, and free otherwise. An alternating path is a path whose edges are alternately in M and not in M. An augmenting path is an alternating path that begins and ends at distinct unmatched (free) vertices. By Berge lemma, a matching M is maximum if and only if the graph admits no augmenting path with respect to M.

## Hopcroft-Karp Algorithm

The Hopcroft-Karp algorithm finds a maximum cardinality bipartite matching in sub-quadratic time. In each phase, it uses Breadth-First Search (BFS) to find the shortest augmenting paths and then Depth-First Search (DFS) to find a maximal set of vertex-disjoint augmenting paths of that shortest length.

## Complexity Bounds

Because the length of the shortest augmenting path strictly increases after each phase, the algorithm executes at most 2 * sqrt(V) phases. Each phase inspects edges in O(V + E) time, leading to an overall worst-case runtime of O(E * sqrt(V)) and O(V + E) space.
