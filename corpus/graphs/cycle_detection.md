# Graph Cycle Detection

Cycle detection determines whether a graph contains at least one simple closed walk of length three or greater. Cycle detection algorithms vary depending on whether the graph is undirected or directed.

## Undirected Graphs using DFS or Disjoint Sets

In an undirected graph, a Depth-First Search maintains a visited array and tracks the parent of the currently visited vertex. If an adjacent neighbor is already visited and is not the immediate parent node, a back-edge exists, confirming a cycle. Alternatively, a Disjoint Set Union structure processes edges sequentially: if both endpoints of an edge belong to the same set, that edge forms a cycle.

## Directed Graphs using Three-Color DFS

In a directed graph, an edge pointing to a visited vertex is not necessarily a cycle (it could be a cross-edge or forward edge). Cycle detection uses a three-state coloring scheme:
1. White: unvisited node.
2. Gray: node currently in the active DFS recursion stack.
3. Black: node whose entire exploration has concluded.

If a directed edge encounters a Gray node, a back-edge pointing to an active ancestor has been discovered, confirming a directed cycle.

## Complexity Bounds

Both undirected DFS and directed three-color DFS visit every vertex and edge a constant number of times, executing in linear O(V + E) time and using O(V) auxiliary memory for colors and the recursion stack.
