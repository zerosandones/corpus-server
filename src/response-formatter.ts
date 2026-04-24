import type { FolderEntry } from "./storage";

export function formatFolderIndex(heading: string, entries: FolderEntry[]): string {
  const lines = [`# ${heading}`, ""];
  for (const entry of entries) {
    const baseName = entry.slug.split("/").pop() ?? entry.slug;
    const label = entry.title ?? baseName;
    lines.push(`- [${label}](/${entry.slug})`);
    if (entry.frontmatter) {
      for (const [key, value] of Object.entries(entry.frontmatter)) {
        const display = Array.isArray(value) ? value.join(", ") : value;
        lines.push(`  - ${key}: ${display}`);
      }
    }
  }
  return lines.join("\n");
}
