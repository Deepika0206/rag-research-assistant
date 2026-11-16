# Dijkstra Shortest Path Algorithm

Dijkstra algorithm determines the shortest path from a starting source node to all other vertices in a weighted graph with non-negative edge weights.

## Relaxation with Priority Queue

The algorithm maintains a distance array initialized to zero for the source node and infinity for all others. A priority queue or min-heap tracks discovered vertices by minimum cumulative distance.

In each step, the vertex with the lowest tentative distance is extracted. For each outgoing edge to neighbor v, relaxation checks if the path through current node u provides a shorter distance than the previously recorded distance to v. If so, distance to v is updated and the pair is pushed to the min-heap.

## Runtime Complexity and Constraints

Using a standard binary min-heap, Dijkstra runs in O((V + E) log V) time. The algorithm is greedy and assumes that once a vertex distance is finalized, no future path can reduce it.

Because negative weights can violate this monotonic non-decreasing path distance property, Dijkstra fails on graphs with negative edges. In such scenarios, the Bellman-Ford algorithm must be used instead.
