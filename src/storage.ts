import { mkdir } from "fs/promises";
import { join } from "path";

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; //validates URL-safe document slugs in kebab-case format

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