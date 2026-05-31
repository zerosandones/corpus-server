import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface Frontmatter {
  title?: string;
  description?: string;
  created?: string;
  updated?: string;
  author?: string;
  tags?: string[];
  security?: {
    level?: "public" | "private" | "confidential";
    roles?: string[];
    users?: string[];
  };
  ai?: { priority?: string; ignore?: boolean; summary?: string };
  custom?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ParsedDocument {
  frontmatter: Frontmatter;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(content: string): ParsedDocument {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  try {
    const frontmatter = (parseYaml(match[1]) as Frontmatter) ?? {};
    return { frontmatter, body: match[2] };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

export function serializeDocument(frontmatter: Frontmatter, body: string): string {
  const yaml = stringifyYaml(frontmatter).trimEnd();
  return `---\n${yaml}\n---\n${body}`;
}

export function extractHeadings(
  body: string
): Array<{ depth: number; text: string; anchor: string }> {
  const headings: Array<{ depth: number; text: string; anchor: string }> = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      const depth = m[1].length;
      const text = m[2].trim();
      const anchor =
        "#" +
        text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
      headings.push({ depth, text, anchor });
    }
  }
  return headings;
}
