# Eulerian Path and Circuit

An Eulerian path in a graph is a trail that visits every edge exactly once. An Eulerian circuit is an Eulerian path that starts and ends at the exact same vertex.

## Existence Theorems

For an undirected connected graph:
1. An Eulerian circuit exists if and only if every vertex has an even degree.
2. An Eulerian path exists if and only if exactly zero or two vertices have an odd degree. If two vertices have odd degree, they serve as the start and end of the path.

For a directed graph, all vertices with non-zero degree must belong to a single strongly connected component, and the in-degree of every vertex must equal its out-degree (for a circuit) or exactly one vertex has out-degree - in-degree = 1 and one vertex has in-degree - out-degree = 1 (for a path).

## Hierholzer Algorithm

Hierholzer algorithm constructs an Eulerian trail in linear time. It maintains an active path stack. Starting from an eligible vertex, it follows unused edges until a vertex with no remaining incident edges is reached. Because of degree parity, this dead-end is part of a sub-cycle. The dead-end vertex is popped and added to the circuit list, while the search continues on the remaining edges.

## Complexity

Because each edge is traversed and removed from the adjacency list exactly once, Hierholzer algorithm runs in optimal Theta(V + E) time and uses O(V + E) auxiliary memory.
