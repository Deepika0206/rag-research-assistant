import type { Link, Root, Text } from "mdast";
import type { Node, Parent } from "unist";
import type { Plugin } from "unified";

function isParent(node: Node): node is Parent {
  return "children" in node && Array.isArray(node.children);
}

export const remarkCitations: Plugin<[Set<string>, Set<string>], Root> =
  (validIds, invalidIds) => (tree) => {
    const visit = (parent: Parent) => {
      const children: Node[] = [];

      for (const child of parent.children) {
        if (child.type === "text" && "value" in child && typeof child.value === "string") {
          const text = child.value;
          const citationPattern = /\[(\d+)\]/g;
          let position = 0;
          let match: RegExpExecArray | null;

          while ((match = citationPattern.exec(text)) !== null) {
            const id = match[1];
            if (!validIds.has(id) && !invalidIds.has(id)) continue;

            if (match.index > position) {
              const plainText: Text = { type: "text", value: text.slice(position, match.index) };
              children.push(plainText);
            }

            const citationLink: Link = {
              type: "link",
              url: `#citation-${id}`,
              children: [{ type: "text", value: match[0] }],
            };
            children.push(citationLink);
            position = match.index + match[0].length;
          }

          if (position > 0) {
            if (position < text.length) {
              const plainText: Text = { type: "text", value: text.slice(position) };
              children.push(plainText);
            }
          } else {
            children.push(child);
          }
          continue;
        }

        if (isParent(child)) visit(child);
        children.push(child);
      }

      parent.children = children;
    };

    visit(tree);
  };
