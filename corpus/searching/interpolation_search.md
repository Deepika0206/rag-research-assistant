# Interpolation Search

Interpolation search is an advanced search algorithm for sorted, uniformly distributed numeric arrays. It estimates the likely position of the target element based on key values at the search interval bounds, mimicking how a human searches a telephone directory.

## Probe Formula and Interpolation

Instead of calculating the median index, interpolation search computes a probe position using the linear interpolation formula: pos = lo + ((target - arr[lo]) * (hi - lo)) / (arr[hi] - arr[lo]). If arr[pos] equals the target, the search terminates. If arr[pos] is less than the target, the search continues in the right sub-array [pos + 1, hi]; otherwise, it resumes in [lo, pos - 1].

## Complexity and Distribution Sensitivity

For uniformly distributed datasets, interpolation search achieves an average-case time complexity of O(log log n), requiring far fewer comparisons than standard binary search. However, if the data distribution is non-uniform or exponentially clustered, the probe formula degrades severely, leading to a worst-case time complexity of O(n).

## Preconditions and Memory Model

Interpolation search requires both strict sorted order and direct O(1) random memory access. It assumes key values can be subtracted and scaled linearly, making it unsuitable for arbitrary non-numeric comparable objects without custom projection functions.
