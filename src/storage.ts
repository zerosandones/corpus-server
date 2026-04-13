import { mkdir, readdir, readFile, writeFile, unlink, stat } from "fs/promises";
import { join } from "path";

export interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const DOCS_DIR = join(import.meta.dir, "..", "documents");

export async function ensureDocsDir(): Promise<void> {
  await mkdir(DOCS_DIR, { recursive: true });
}

function docPath(id: string): string {
  return join(DOCS_DIR, `${id}.md`);
}

function metaPath(id: string): string {
  return join(DOCS_DIR, `${id}.json`);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  await ensureDocsDir();
  const entries = await readdir(DOCS_DIR);
  const ids = entries
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));

  const docs: DocumentMeta[] = [];
  for (const id of ids) {
    try {
      const meta = JSON.parse(
        await readFile(metaPath(id), "utf-8")
      ) as DocumentMeta;
      docs.push(meta);
    } catch {
      // skip documents with missing metadata
    }
  }
  return docs;
}

export async function getDocument(id: string): Promise<Document | null> {
  await ensureDocsDir();
  try {
    const [content, meta] = await Promise.all([
      readFile(docPath(id), "utf-8"),
      readFile(metaPath(id), "utf-8"),
    ]);
    const { title, createdAt, updatedAt } = JSON.parse(meta) as DocumentMeta;
    return { id, title, content, createdAt, updatedAt };
  } catch {
    return null;
  }
}

export async function createDocument(
  title: string,
  content: string,
  idOverride?: string
): Promise<Document> {
  await ensureDocsDir();
  const baseId = idOverride ?? slugify(title);
  const id = baseId !== "" ? baseId : crypto.randomUUID();
  const now = new Date().toISOString();

  // Ensure unique id
  let finalId = id;
  try {
    await stat(docPath(finalId));
    finalId = `${id}-${Date.now()}`;
  } catch {
    // file doesn't exist, id is available
  }

  const meta: DocumentMeta = { id: finalId, title, createdAt: now, updatedAt: now };
  await Promise.all([
    writeFile(docPath(finalId), content, "utf-8"),
    writeFile(metaPath(finalId), JSON.stringify(meta, null, 2), "utf-8"),
  ]);
  return { ...meta, content };
}

export async function updateDocument(
  id: string,
  updates: { title?: string; content?: string }
): Promise<Document | null> {
  await ensureDocsDir();
  const existing = await getDocument(id);
  if (!existing) return null;

  const title = updates.title ?? existing.title;
  const content = updates.content ?? existing.content;
  const updatedAt = new Date().toISOString();

  const meta: DocumentMeta = {
    id,
    title,
    createdAt: existing.createdAt,
    updatedAt,
  };

  await Promise.all([
    writeFile(docPath(id), content, "utf-8"),
    writeFile(metaPath(id), JSON.stringify(meta, null, 2), "utf-8"),
  ]);
  return { ...meta, content };
}

export async function deleteDocument(id: string): Promise<boolean> {
  await ensureDocsDir();
  try {
    await Promise.all([unlink(docPath(id)), unlink(metaPath(id))]);
    return true;
  } catch {
    return false;
  }
}
