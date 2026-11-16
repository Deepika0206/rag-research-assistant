# Graph Traversal: BFS and DFS

Graph traversal systematically visits nodes and edges in a network without cycling indefinitely.

## Breadth-First Search (BFS)

Breadth-First Search uses a queue to visit vertices layer by layer in order of graph distance from the origin. Starting at a root node, all immediate neighbors are visited before proceeding to distance two neighbors.

Because BFS explores outward evenly, it computes the exact shortest path in unweighted graphs. Time complexity is O(V + E) with O(V) space for the queue and visited state.

## Depth-First Search (DFS)

Depth-First Search explores deeply along connected branches before backtracking. It operates using recursion or an explicit stack.

DFS is suited for topological sorting, cycle detection, and finding strongly connected components. A cycle in a directed graph is detected if DFS encounters an edge pointing to an ancestor currently residing in the active recursion call stack.
