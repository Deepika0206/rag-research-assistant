# Trie Data Structure

A trie, also known as a digital tree or prefix tree, is an ordered tree data structure used to store an associative array where the keys are usually strings. Unlike a standard binary search tree, no node in the tree stores the key associated with that node; instead, its position in the tree defines the associated key.

## Node Organization and Prefix Sharing

All descendants of a node share a common string prefix associated with that node. The root node is associated with the empty string. Each node contains an array or map of outgoing child pointers indexed by alphabet characters (for example, an array of size 26 for lowercase English letters) and a boolean is_end_of_word flag indicating whether the string path ending at that node represents a complete stored word.

## Insertion, Search, and Autocomplete

To insert a word of length L, the algorithm traverses from the root, creating missing nodes along the character path, and sets is_end_of_word to true at the final node. Searching for an exact word follows the character sequence and checks if the terminal node has is_end_of_word enabled. Searching for a prefix follows the characters down to the prefix root; all subtree descendants represent completions of that prefix.

## Time and Space Complexity

Insertion, search, and prefix lookups all run in O(L) time, where L is the length of the string, completely independent of the total number of words n in the dictionary. The worst-case space complexity is O(ALPHABET_SIZE * L * n), which can be optimized using compressed radix trees or pointer maps.
