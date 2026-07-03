import { readdirSync, statSync } from "fs";
import { join } from "path/posix";
import { parseFrontmatter } from "../../utils/frontmatter";

/** Represents a single document entry returned by a folder listing. */
export type FolderEntry = {
  /** Path from the documents root, without the .md extension (e.g. "my-doc" or "category/my-doc"). */
  slug: string;
  /** The title: first the frontmatter `title` field, then the first H1 heading, or null if neither exists. */
  title: string | null;
  /** Parsed YAML frontmatter key/value pairs, or undefined if no frontmatter is present. */
  frontmatter: Record<string, string | string[]> | undefined;
};

export async function getDocument(
  slug: string,
  baseDir: string = "documents",
): Promise<string | null> {
  try {
    let filePath = `${baseDir}/${slug}`;

    // Add .md extension if not present
    if (!filePath.endsWith(".md")) {
      filePath += ".md";
    }

    const file = Bun.file(filePath);
    const exists = await file.exists();

    if (!exists) {
      return null;
    }

    return file.text();
  } catch (error) {
    console.error(`Error reading document ${slug}:`, error);
    return null;
  }
}

/**
 * Lists all markdown files in a directory with their frontmatter
 * Returns a formatted markdown document
 */
export async function getDir(
  slug: string = "",
  baseDir: string = "documents",
): Promise<FolderEntry[] | null> {
  let dir = baseDir;
  if (slug != "") {
    dir += `/${slug}`;
  }

  let dirEntries: import("fs").Dirent[];
  try {
    dirEntries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const results: FolderEntry[] = [];
  for (const entry of dirEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const baseName = entry.name.slice(0, -3);
      const folderPath = slug ? `${slug}/${baseName}` : baseName;
      const filePath = join(dir, entry.name);
      const content = await Bun.file(filePath).text();
      const fm = parseFrontmatter(content);
      const frontmatterTitle =
        typeof fm?.["title"] === "string" ? fm["title"] : null;
      const headingMatch = content.match(/^#\s+(.+)$/m);
      const headingTitle = headingMatch ? headingMatch[1]!.trim() : null;
      results.push({
        slug: folderPath,
        title: frontmatterTitle ?? headingTitle,
        frontmatter: fm,
      });
    }
  }

  return results;
}

export async function saveDocument(
  slug: string,
  content: string,
): Promise<void> {
  return Promise.resolve();
}

export async function deleteDocument(slug: string): Promise<void> {
  return Promise.resolve();
}
