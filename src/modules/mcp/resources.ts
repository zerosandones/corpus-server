import type { Database } from "bun:sqlite";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAll } from "../index/service";
import { getDocument } from "../storage/service";
import { isValidSlug } from "../../utils/slug-check";

const CORPUS_SCHEME = "corpus";

/**
 * Converts a document slug to a corpus:// URI.
 * e.g. "engineering/architecture" → "corpus://engineering/architecture"
 */
function slugToUri(slug: string): string {
  return `${CORPUS_SCHEME}://${slug}`;
}

/**
 * Parses a corpus:// URI back into a slug string.
 * e.g. "corpus://engineering/architecture" → "engineering/architecture"
 * Returns null if the URI is not a valid corpus:// URI.
 */
function uriToSlug(uri: URL): string | null {
  if (uri.protocol !== `${CORPUS_SCHEME}:`) return null;
  // URL parses "corpus://engineering/architecture" with:
  //   hostname = "engineering"  pathname = "/architecture"
  // Re-join them to reconstruct the full slug.
  const host = uri.hostname;
  const path = uri.pathname.replace(/^\//, "");
  return path ? `${host}/${path}` : host;
}

/**
 * Registers all Corpus Server resources on the given McpServer instance.
 *
 * Statically registered resource template:
 *   corpus://{slug}  — read any document by slug.
 *
 * The resource list is built dynamically from the SQLite index so that
 * documents with ai.ignore: true are never surfaced.
 */
export function registerResources(server: McpServer, db: Database): void {
  const template = new ResourceTemplate(`${CORPUS_SCHEME}://{+slug}`, {
    list: () => {
      const docs = getAll(db);
      return {
        resources: docs.map((doc) => ({
          uri: slugToUri(doc.slug),
          name: doc.title ?? doc.slug,
          description: doc.description ?? undefined,
          mimeType: "text/markdown",
        })),
      };
    },
  });

  server.registerResource(
    "corpus-document",
    template,
    {
      description:
        "A Markdown document stored in Corpus Server. Retrieve by its slug URI (corpus://path/to/document).",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const slug = uriToSlug(uri);

      if (!slug || !isValidSlug(slug)) {
        throw new Error(
          `Invalid corpus URI '${uri.toString()}' — cannot extract a valid slug.`,
        );
      }

      const content = await getDocument(slug);
      if (content === null) {
        throw new Error(
          `Document '${slug}' not found.`,
        );
      }

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text: content,
          },
        ],
      };
    },
  );
}
