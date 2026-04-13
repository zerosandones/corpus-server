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

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Serialize a metadata object as a YAML front matter block. */
function serializeFrontMatter(meta: DocumentMeta): string {
  return [
    "---",
    `id: ${meta.id}`,
    `title: ${meta.title}`,
    `createdAt: ${meta.createdAt}`,
    `updatedAt: ${meta.updatedAt}`,
    "---",
    "",
  ].join("\n");
}

/** Parse a YAML front matter block from the start of a markdown string.
 *  Returns the parsed fields and the body text that follows the block.
 */
function parseFrontMatter(raw: string): { meta: Partial<DocumentMeta>; body: string } {
  const fmRegex = /^---\n([\s\S]*?)\n---\n?/;
  const match = raw.match(fmRegex);
  if (!match) {
    return { meta: {}, body: raw };
  }
  const fmBlock = match[1] ?? "";
  const body = raw.slice(match[0].length);
  const meta: Partial<DocumentMeta> = {};
  for (const line of fmBlock.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim() as keyof DocumentMeta;
    const value = line.slice(colon + 1).trim();
    meta[key] = value;
  }
  return { meta, body };
}

/** Compose a full file string from metadata and body content. */
function compose(meta: DocumentMeta, body: string): string {
  return serializeFrontMatter(meta) + body;
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
      const raw = await readFile(docPath(id), "utf-8");
      const { meta } = parseFrontMatter(raw);
      if (meta.id && meta.title && meta.createdAt && meta.updatedAt) {
        docs.push(meta as DocumentMeta);
      }
    } catch {
      // skip documents that cannot be read or parsed
    }
  }
  return docs;
}

export async function getDocument(id: string): Promise<Document | null> {
  await ensureDocsDir();
  try {
    const raw = await readFile(docPath(id), "utf-8");
    const { meta, body } = parseFrontMatter(raw);
    if (!meta.id || !meta.title || !meta.createdAt || !meta.updatedAt) {
      return null;
    }
    return {
      id: meta.id,
      title: meta.title,
      content: body,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    };
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
  await writeFile(docPath(finalId), compose(meta, content), "utf-8");
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

  await writeFile(docPath(id), compose(meta, content), "utf-8");
  return { ...meta, content };
}

export async function deleteDocument(id: string): Promise<boolean> {
  await ensureDocsDir();
  try {
    await unlink(docPath(id));
    return true;
  } catch {
    return false;
  }
}

