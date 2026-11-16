# Floyd-Warshall Algorithm

The Floyd-Warshall algorithm is a dynamic programming algorithm that finds the shortest paths between all pairs of vertices in a weighted directed graph, accommodating positive and negative edge weights.

## Dynamic Programming Formulation

Let dist[i][j][k] be the shortest path from vertex i to vertex j using only intermediate vertices from the set {0, 1, ..., k}. The recurrence relation tests whether routing through vertex k produces a shorter distance: dist[i][j][k] = min(dist[i][j][k - 1], dist[i][k][k - 1] + dist[k][j][k - 1]). In memory-optimized implementations, the third dimension is compressed into an in-place V x V matrix: dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]).

## Loop Order and State Invariant

The outer loop must iterate through the intermediate pivot vertex k from 0 to V - 1, while inner loops iterate through all source vertices i and destination vertices j. Changing the loop order breaks the dynamic programming state progression and produces invalid distances.

## Complexity and Negative Cycle Detection

Because of the three strictly nested loops over V vertices, Floyd-Warshall runs in exact Theta(V^3) time and uses Theta(V^2) space. After the algorithm completes, checking if dist[i][i] < 0 for any vertex i detects the existence of a negative cycle in the graph.
