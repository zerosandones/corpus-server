import { mkdir } from "fs/promises";
import { join } from "path";

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; //validates URL-safe document slugs in kebab-case format

/** Represents the outcome of a save-document operation. */
export type SaveDocumentResult = "created" | "conflict" | "invalid";

/** Represents the outcome of an update-document operation. */
export type UpdateDocumentResult = "updated" | "not_found" | "invalid";

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

/** Updates an existing document at the specified slug path.
 * The slug may include forward-slash-separated path segments (e.g., "category/my-doc").
 * Each path segment must be in kebab-case format (lowercase letters, numbers, and hyphens).
 * Returns "updated" when the document is overwritten successfully,
 * "not_found" when no document exists at that path,
 * and "invalid" when any path segment fails validation.
 *
 * @param slug The document slug, optionally including subdirectory segments (e.g., "category/my-doc").
 * @param content The new Markdown content to write.
 * @param folderName The root folder to update into (default: "documents").
 * @returns A promise that resolves to "updated", "not_found", or "invalid".
 * @example
 * await updateDocument("my-doc", "# Updated"); // updates documents/my-doc.md
 * await updateDocument("category/my-doc", "# Updated"); // updates documents/category/my-doc.md
 */
export async function updateDocument(
  slug: string,
  content: string,
  folderName: string = "documents"
): Promise<UpdateDocumentResult> {
  const segments = slug.split("/");
  if (segments.length === 0 || segments.some((s) => !SAFE_SLUG.test(s))) {
    return "invalid";
  }

  const filePath = join(import.meta.dir, "..", folderName, `${slug}.md`);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return "not_found";
  }

  await Bun.write(filePath, content);
  return "updated";
}