import { mkdir } from "fs/promises";
import { join } from "path";

const DOCS_DIR = join(import.meta.dir, "..", "documents");

export async function ensureDocsDir(): Promise<void> {
  await mkdir(DOCS_DIR, { recursive: true });
}

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function getDocument(slug: string): Promise<string | null> {
  if (!SAFE_SLUG.test(slug)) {
    return null;
  }
  const filePath = join(DOCS_DIR, `${slug}.md`);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }
  return file.text();
}