import json
import re


def strip_tags(text: str, tags: list[str] | tuple[str, ...] = ("claim", "chunk", "cited_chunk", "check", "relation")) -> str:
    """Robustly remove opening, closing, nested, and unclosed prompt tags from text."""
    if not text:
        return ""
    result = text
    # Pattern to match opening and closing tags for any specified tag name
    tag_pattern = "|".join(tags)
    # Remove complete opening/closing tags case-insensitively
    pattern = rf"</?(?:{tag_pattern})(?:\s+[^>]*)?/?>"
    prev = None
    # Loop to handle nested tags like <claim><claim>text</claim></claim>
    while prev != result:
        prev = result
        result = re.sub(pattern, "", result, flags=re.IGNORECASE)
    # Also strip any stray dangling open tags like '<claim' at end or '<claim '
    dangling = rf"</?(?:{tag_pattern})\b[^>]*$"
    result = re.sub(dangling, "", result, flags=re.IGNORECASE)
    return result


def extract_json(text: str):
    """Find valid JSON in a model reply. Handles markdown code blocks, trailing text,

    multiple candidate objects, and nested objects. Returns parsed value or None.
    """
    if not text:
        return None

    # 1. First check for markdown code blocks ```json ... ```
    md_blocks = re.findall(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text, re.IGNORECASE)
    for block in md_blocks:
        try:
            return json.loads(block.strip())
        except json.JSONDecodeError:
            pass

    # 2. Balanced brace search to find candidate JSON objects
    # This correctly isolates the first valid {...} block even if followed by trailing explanation
    n = len(text)
    for start in range(n):
        if text[start] == '{':
            depth = 0
            in_string = False
            escape = False
            for end in range(start, n):
                c = text[end]
                if escape:
                    escape = False
                    continue
                if c == '\\':
                    escape = True
                    continue
                if c == '"':
                    in_string = not in_string
                    continue
                if not in_string:
                    if c == '{':
                        depth += 1
                    elif c == '}':
                        depth -= 1
                        if depth == 0:
                            candidate = text[start:end + 1]
                            try:
                                return json.loads(candidate)
                            except json.JSONDecodeError:
                                break

    # 3. Fallback to standard regex match if any
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None
