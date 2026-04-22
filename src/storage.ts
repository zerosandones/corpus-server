import { mkdir, readdir } from "fs/promises";
import { join } from "path";

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; //validates URL-safe document slugs in kebab-case format

/** Represents the outcome of a save-document operation. */
export type SaveDocumentResult = "created" | "conflict" | "invalid";

/** Ensures the specified documents directory exists.
 * By default, it creates a "documents" directory in the parent directory of this module.
 * You can specify a different folder name if needed (e.g., for testing).
 * 
 * @param folderName The name of the folder to create (default: "documents").
 * @returns A promise that resolves when the directory is ensured.
 * @throws If there is an error creating the directory (other than it already existing).
 * @example
 * await ensureDocsDir(); // Ensures "documents" directory exists
 * await ensureDocsDir("temp"); // Ensures "temp" directory exists (useful for tests)
 */
export async function ensureDocsDir(folderName: string = "documents"): Promise<void> {
  const dir = join(import.meta.dir, "..", folderName);
  await mkdir(dir, { recursive: true });
}

/** Retrieves the content of a document based on its slug.
 * The slug must be in kebab-case format (lowercase letters, numbers, and hyphens).
 * The function looks for a Markdown file with the name `${slug}.md` in the specified folder.
 * If the file exists and the slug is valid, it returns the content as a string.
 * If the file does not exist or the slug is invalid, it returns null.
 * 
 * @param slug The document slug (e.g., "my-document").
 * @param folderName The name of the folder where documents are stored (default: "documents").
 * @returns A promise that resolves to the document content as a string, or null if not found/invalid.
 * @example
 * const content = await getDocument("my-document"); // Retrieves content of "documents/my-document.md"
 * const content = await getDocument("test-doc", "temp"); // Retrieves content of "temp/test-doc.md"
 */
export async function getDocument(slug: string, folderName: string = "documents"): Promise<string | null> {
  if (!SAFE_SLUG.test(slug)) {
    return null;
  }
  const filePath = join(import.meta.dir, "..", folderName, `${slug}.md`);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }
  return file.text();
}

/** Saves a document to the specified path, creating directories as needed.
 * The slug may include forward-slash-separated path segments (e.g., "category/my-doc").
 * Each path segment must be in kebab-case format (lowercase letters, numbers, and hyphens).
 * Returns "created" when the document is written successfully,
 * "conflict" when a document already exists at that path,
 * and "invalid" when any path segment fails validation.
 *
 * @param slug The document slug, optionally including subdirectory segments (e.g., "category/my-doc").
 * @param content The Markdown content to save.
 * @param folderName The root folder to save into (default: "documents").
 * @returns A promise that resolves to "created", "conflict", or "invalid".
 * @example
 * await saveDocument("my-doc", "# Hello"); // saves to documents/my-doc.md
 * await saveDocument("category/my-doc", "# Hello"); // saves to documents/category/my-doc.md
 */
export async function saveDocument(
  slug: string,
  content: string,
  folderName: string = "documents"
): Promise<SaveDocumentResult> {
  const segments = slug.split("/");
  if (segments.length === 0 || segments.some((s) => !SAFE_SLUG.test(s))) {
    return "invalid";
  }

  const filePath = join(import.meta.dir, "..", folderName, `${slug}.md`);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    return "conflict";
  }

  const fileDir = join(import.meta.dir, "..", folderName, ...segments.slice(0, -1));
  if (segments.length > 1) {
    await mkdir(fileDir, { recursive: true });
  }
  await Bun.write(filePath, content);
  return "created";
}

/** Represents a single document entry returned by a folder listing. */
export type FolderEntry = {
  /** Path from the documents root, without the .md extension (e.g. "my-doc" or "category/my-doc"). */
  slug: string;
  /** The title: first the frontmatter `title` field, then the first H1 heading, or null if neither exists. */
  title: string | null;
  /** Parsed YAML frontmatter key/value pairs, or null if no frontmatter is present. */
  frontmatter: Record<string, string | string[]> | null;
};

/**
 * Parses a YAML frontmatter block from a Markdown document.
 * Supports simple scalar values and inline arrays (`[a, b, c]`).
 * Returns null when no valid frontmatter block is found.
 */
function parseFrontmatter(content: string): Record<string, string | string[]> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const result: Record<string, string | string[]> = {};
  for (const line of match[1].split(/\r?\n/)) {
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

  return Object.keys(result).length > 0 ? result : null;
}

/** Lists all Markdown documents in a folder inside the documents directory.
 * Returns an array of entries (possibly empty) when the folder exists,
 * or null when the folder does not exist.
 *
 * @param folderPath Path relative to the documents root (default: "" for the root).
 * @param folderName The name of the base directory (relative to the project root) that contains all documents (default: "documents").
 * @returns A promise resolving to an array of FolderEntry objects, or null if the folder does not exist.
 * @example
 * const entries = await listFolder(); // lists documents in "documents/"
 * const entries = await listFolder("category"); // lists documents in "documents/category/"
 */
export async function listFolder(
  folderPath: string = "",
  folderName: string = "documents"
): Promise<FolderEntry[] | null> {
  const dir = join(import.meta.dir, "..", folderName, folderPath);

  let dirEntries: import("fs").Dirent[];
  try {
    dirEntries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const results: FolderEntry[] = [];
  for (const entry of dirEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const baseName = entry.name.slice(0, -3);
      const slug = folderPath ? `${folderPath}/${baseName}` : baseName;
      const filePath = join(dir, entry.name);
      const content = await Bun.file(filePath).text();
      const fm = parseFrontmatter(content);
      const frontmatterTitle = typeof fm?.["title"] === "string" ? fm["title"] : null;
      const headingMatch = content.match(/^#\s+(.+)$/m);
      const headingTitle = headingMatch ? headingMatch[1].trim() : null;
      results.push({
        slug,
        title: frontmatterTitle ?? headingTitle,
        frontmatter: fm,
      });
    }
  }

  return results;
}