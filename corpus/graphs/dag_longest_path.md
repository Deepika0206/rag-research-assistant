# Longest Path in Directed Acyclic Graphs

Finding the longest simple path in a general directed graph is an NP-hard problem. However, if the graph is a Directed Acyclic Graph (DAG), the longest path can be found in linear time using topological sorting and dynamic programming.

## Inversion and Topological Ordering

Because a DAG contains no directed cycles, vertices can be linearized into a topological order. In this topological sequence, every directed edge (u, v) points strictly from an earlier vertex to a later vertex. This property allows distance states to be evaluated without cyclic dependencies.

## Dynamic Programming Recurrence

Let dist[v] be the length of the longest path ending at vertex v. The base case initializes dist[s] = 0 for the source vertex, and negative infinity for all others. Processing vertices in topological order: for each vertex u and every outgoing edge (u, v) with weight w, the relaxation tests if dist[u] + w > dist[v]. If so, dist[v] is updated to dist[u] + w, and parent[v] is set to u.

## Complexity and Applications

Topological sorting requires O(V + E) time, and relaxing each edge once takes O(V + E) time. Thus, the longest path in a DAG is computed in strictly linear O(V + E) time and O(V) space. This algorithm is the computational foundation of the Critical Path Method (CPM) in project management and pipeline scheduling.
