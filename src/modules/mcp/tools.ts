import type { Database } from "bun:sqlite";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAll, findByTag, findByTitle } from "../index/service";
import { getDocument } from "../storage/service";
import { isValidSlug } from "../../utils/slug-check";

/**
 * Registers all Corpus Server tools on the given McpServer instance.
 */
export function registerTools(server: McpServer, db: Database): void {
  // ------------------------------------------------------------------
  // list_documents
  // ------------------------------------------------------------------
  server.registerTool(
    "list_documents",
    {
      title: "List Documents",
      description:
        "Returns all indexed documents. Pass an optional scope (directory prefix) to filter results to a sub-folder. Documents marked with ai.ignore: true are never returned.",
      inputSchema: {
        scope: z
          .string()
          .optional()
          .describe(
            "Optional directory prefix to filter results (e.g. 'engineering' or 'engineering/design').",
          ),
      },
    },
    ({ scope }) => {
      const docs = getAll(db);
      const filtered = scope
        ? docs.filter(
            (d) => d.slug === scope || d.slug.startsWith(`${scope}/`),
          )
        : docs;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filtered, null, 2),
          },
        ],
      };
    },
  );

  // ------------------------------------------------------------------
  // get_document
  // ------------------------------------------------------------------
  server.registerTool(
    "get_document",
    {
      title: "Get Document",
      description:
        "Fetches the raw Markdown content of a single document by its slug. Returns the full content including YAML frontmatter.",
      inputSchema: {
        slug: z
          .string()
          .describe(
            "The document slug (path without .md extension, e.g. 'engineering/architecture').",
          ),
      },
    },
    async ({ slug }) => {
      if (!isValidSlug(slug)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                code: "BAD_REQUEST",
                message:
                  "Invalid slug — path traversal or invalid characters detected.",
                slug,
              }),
            },
          ],
        };
      }

      const content = await getDocument(slug);
      if (content === null) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                code: "NOT_FOUND",
                message: `Document '${slug}' does not exist.`,
                slug,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    },
  );

  // ------------------------------------------------------------------
  // search_documents
  // ------------------------------------------------------------------
  server.registerTool(
    "search_documents",
    {
      title: "Search Documents",
      description:
        "Searches indexed documents by a text query (matched against title and description) and/or one or more tags. Results from both searches are merged and deduplicated.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Text to search for in document title and description (case-insensitive substring match).",
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe("One or more tags to filter by."),
      },
    },
    ({ query, tags }) => {
      const seen = new Set<string>();
      const results = [];

      if (query) {
        for (const doc of findByTitle(query, db)) {
          if (!seen.has(doc.slug)) {
            seen.add(doc.slug);
            results.push(doc);
          }
        }
      }

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          for (const doc of findByTag(tag, db)) {
            if (!seen.has(doc.slug)) {
              seen.add(doc.slug);
              results.push(doc);
            }
          }
        }
      }

      // If neither query nor tags provided, behave as a full document listing.
      // This lets clients use a single tool to enumerate all documents without
      // needing to know about list_documents.
      if (!query && (!tags || tags.length === 0)) {
        for (const doc of getAll(db)) {
          results.push(doc);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}
