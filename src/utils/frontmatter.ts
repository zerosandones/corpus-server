/**
 * Parses a YAML frontmatter block from a Markdown document.
 * Supports simple scalar values and inline arrays (`[a, b, c]`).
 * Returns null when no valid frontmatter block is found.
 */
export function parseFrontmatter(
  content: string,
): Record<string, string | string[]> | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;

  const result: Record<string, string | string[]> = {};
  for (const line of match.at(1)!.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();
    if (!key) continue;

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      result[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      result[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
