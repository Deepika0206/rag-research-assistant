# Kosaraju Algorithm

Kosaraju algorithm is a linear-time graph algorithm that finds all Strongly Connected Components (SCCs) in a directed graph using two consecutive Depth-First Search passes and the transpose of the input graph.

## Two-Pass Traversal Strategy

The first pass executes a standard DFS over the original graph G. When a vertex finishes all recursive explorations, it is pushed onto a stack. Consequently, the vertex that finishes last in the entire DFS forest rests on top of the stack, representing a sink component in the DAG of SCCs.

## Transpose Graph Processing

The algorithm then constructs the transpose graph G^T by reversing the direction of every edge in G. Reversing edges leaves the internal connectivity of every individual SCC invariant, while inverting the directed reachability between different SCCs.

## Second Pass Component Extraction

In the second pass, vertices are popped one by one from the stack. If the popped vertex has not yet been visited in G^T, a second DFS is launched from that vertex within G^T. All vertices reached during this traversal form an independent strongly connected component.

## Complexity Bounds

Constructing the transpose graph takes O(V + E) time, and both DFS traversals run in O(V + E) time. Thus, Kosaraju algorithm operates in Theta(V + E) time and O(V + E) space.
