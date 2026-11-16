# Jump Search

Jump search, also called block search, operates on sorted arrays by advancing through the data in fixed-size blocks of step length m, followed by a backward linear scan once a block bounding the target element is encountered.

## Optimal Step Size Formulation

To minimize total comparisons, the algorithm jumps ahead by step m until reaching an element greater than or equal to the target. It then carries out a linear search from the previous jump index to locate the exact position. The total operations equal (n / m) jumps plus at most (m - 1) linear steps. Differentiating (n / m) + m with respect to m yields the optimal block size m = floor(sqrt(n)).

## Time Complexity and Trade-Offs

With the optimal block size of sqrt(n), both the jumping phase and the subsequent linear scan require at most sqrt(n) steps. The worst-case and average-case time complexities are strictly O(sqrt(n)) with O(1) auxiliary space.

## Comparison with Binary Search

Jump search traverses backwards only once per execution. This single-direction traversal is advantageous in hardware platforms where jumping backwards is costly, such as tape storage or unidirectional singly-linked skip structures.
