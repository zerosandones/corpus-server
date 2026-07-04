export type SecurityLevel = "public" | "private" | "confidential";
export type AiPriority = "high" | "medium" | "low";

export interface DocumentSecurity {
  level?: SecurityLevel;
  roles?: string[];
  users?: string[];
}

export interface DocumentAi {
  priority?: AiPriority;
  ignore?: boolean;
  summary?: string;
}

/** Typed representation of all recognised frontmatter fields. */
export interface DocumentFrontmatter {
  title?: string;
  description?: string;
  created?: string;
  updated?: string;
  author?: string;
  tags?: string[];
  security?: DocumentSecurity;
  ai?: DocumentAi;
  custom?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseInlineArray(raw: string): string[] {
  return raw
    .slice(1, -1)
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function parseScalar(raw: string): string {
  return raw.replace(/^["']|["']$/g, "");
}

/**
 * Parses a block of YAML lines into a flat string/array record.
 * Used internally by both parsers.
 */
function parseYamlLines(
  lines: string[],
): Record<string, string | string[] | boolean> {
  const result: Record<string, string | string[] | boolean> = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();
    if (!key) continue;

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      result[key] = parseInlineArray(rawValue);
    } else if (rawValue === "true") {
      result[key] = true;
    } else if (rawValue === "false") {
      result[key] = false;
    } else {
      result[key] = parseScalar(rawValue);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

/**
 * Parses a YAML frontmatter block into a strongly-typed `DocumentFrontmatter`
 * object. Handles nested objects for `security`, `ai`, and `custom` blocks.
 * Returns `undefined` when no valid frontmatter block is found.
 */
export function parseDocumentFrontmatter(
  content: string,
): DocumentFrontmatter | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;

  const lines = match.at(1)!.split(/\r?\n/);

  // Group lines into top-level keys and their indented children.
  type Section = { key: string; value: string; children: string[] };
  const sections: Section[] = [];

  for (const line of lines) {
    const isIndented = /^\s+/.test(line) && line.trim() !== "";
    if (isIndented) {
      sections.at(-1)?.children.push(line.trim());
      continue;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();
    if (!key) continue;
    sections.push({ key, value: rawValue, children: [] });
  }

  if (sections.length === 0) return undefined;

  const fm: DocumentFrontmatter = {};

  for (const { key, value, children } of sections) {
    if (children.length > 0) {
      // Nested object block — parse children as flat key/value pairs.
      const nested = parseYamlLines(children);

      if (key === "security") {
        const sec: DocumentSecurity = {};
        if (typeof nested["level"] === "string") {
          sec.level = nested["level"] as SecurityLevel;
        }
        if (Array.isArray(nested["roles"])) sec.roles = nested["roles"];
        if (Array.isArray(nested["users"])) sec.users = nested["users"];
        fm.security = sec;
      } else if (key === "ai") {
        const ai: DocumentAi = {};
        if (typeof nested["priority"] === "string") {
          ai.priority = nested["priority"] as AiPriority;
        }
        if (typeof nested["ignore"] === "boolean") {
          ai.ignore = nested["ignore"];
        }
        if (typeof nested["summary"] === "string") {
          ai.summary = nested["summary"];
        }
        fm.ai = ai;
      } else if (key === "custom") {
        const custom: Record<string, string> = {};
        for (const [k, v] of Object.entries(nested)) {
          if (typeof v === "string") custom[k] = v;
        }
        fm.custom = custom;
      }
      continue;
    }

    // Flat scalar / inline-array fields.
    if (!value) continue;

    switch (key) {
      case "title":
        fm.title = parseScalar(value);
        break;
      case "description":
        fm.description = parseScalar(value);
        break;
      case "created":
        fm.created = parseScalar(value);
        break;
      case "updated":
        fm.updated = parseScalar(value);
        break;
      case "author":
        fm.author = parseScalar(value);
        break;
      case "tags":
        if (value.startsWith("[") && value.endsWith("]")) {
          fm.tags = parseInlineArray(value);
        }
        break;
    }
  }

  return Object.keys(fm).length > 0 ? fm : undefined;
}
