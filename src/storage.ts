import { mkdir } from "fs/promises";
import { join } from "path";

const DOCS_DIR = join(import.meta.dir, "..", "documents");

export async function ensureDocsDir(): Promise<void> {
  await mkdir(DOCS_DIR, { recursive: true });
}