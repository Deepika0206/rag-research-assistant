# Topological Sort

Topological sort is an ordering of vertices in a Directed Acyclic Graph (DAG) such that for every directed edge u -> v, vertex u comes before vertex v in the ordering. If a graph contains any directed cycle, no topological sort is possible.

## Kahn Algorithm using In-Degrees

Kahn algorithm maintains the in-degree of every vertex. It initializes a queue containing all vertices with an in-degree of 0. In each step, a vertex u is dequeued and appended to the topological order list. For every directed neighbor v of u, the in-degree of v is decremented by 1. If v reaches in-degree 0, it is enqueued. If the final ordered list contains fewer than V vertices, the graph contains at least one cycle.

## Depth-First Search Post-Order Traversal

Alternatively, topological sort can be performed using DFS. During traversal, vertices are marked with three states (unvisited, visiting, visited). If a visiting node is encountered, a back-edge and cycle exist. As each DFS exploration completes, the vertex is pushed onto a stack. Reversing the finish times or popping from the stack yields a valid topological order.

## Complexity and Applications

Both Kahn algorithm and DFS-based topological sort run in optimal O(V + E) time and use O(V) auxiliary space. Topological sorting is foundational for build dependency resolution, task scheduling, course prerequisite verification, and finding critical paths in project networks.
