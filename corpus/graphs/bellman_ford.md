# Bellman-Ford Algorithm

The Bellman-Ford algorithm computes single-source shortest paths in weighted directed graphs, supporting edges with negative weights and providing cycle detection capability where Dijkstra algorithm fails.

## Edge Relaxation Principle

Bellman-Ford initializes the source distance to 0 and all other vertex distances to infinity. It then relaxes every edge in the graph across V - 1 consecutive rounds. In round k, for each edge (u, v) with weight w, if dist[u] + w < dist[v], dist[v] is updated to dist[u] + w. Because any simple shortest path in a graph with V vertices contains at most V - 1 edges, V - 1 relaxation iterations guarantee convergence to optimal shortest distances.

## Negative Weight Cycle Detection

After completing V - 1 rounds, a final verification pass iterates over every edge (u, v) with weight w. If dist[u] + w < dist[v] can still be relaxed, the graph contains a negative-weight cycle reachable from the source vertex. Such cycles allow arbitrary reduction of path weights to negative infinity.

## Time and Space Complexity

Iterating through all E edges across V - 1 rounds requires O(V * E) time in both average and worst cases. The auxiliary space requirement is O(V) to store distance and predecessor arrays. An optimization with an early termination flag halts execution if an entire round produces zero distance updates.
