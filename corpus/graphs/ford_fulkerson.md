# Ford-Fulkerson Algorithm

The Ford-Fulkerson method solves the maximum network flow problem by repeatedly finding augmenting paths from source vertex s to sink vertex t in a residual capacity network until no path exists.

## Residual Graphs and Augmenting Paths

Let G = (V, E) be a directed flow network with non-negative capacity c(u, v) and flow f(u, v). The residual capacity is defined as c_f(u, v) = c(u, v) - f(u, v) for forward edges, and c_f(v, u) = f(u, v) for backward edges to enable flow cancellation. An augmenting path is any simple directed path from s to t in the residual graph where every edge has positive residual capacity.

## Augmentation Bottleneck

For a discovered path P, the bottleneck residual capacity is bottleneck = min(c_f(u, v) for (u, v) in P). The algorithm increases the total network flow by bottleneck, pushing additional flow along forward edges and decreasing flow along backward edges.

## Max-Flow Min-Cut Theorem and Complexity

By the Max-Flow Min-Cut theorem, the value of the maximum flow equals the capacity of the minimum s-t cut. When augmenting paths are found using Breadth-First Search (the Edmonds-Karp algorithm), path length increases monotonically, guaranteeing termination in O(V * E^2) time regardless of edge capacity values.
