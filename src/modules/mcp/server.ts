import type { Database } from "bun:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools";
import { registerResources } from "./resources";

/**
 * Creates and configures a fully wired McpServer instance backed by the
 * provided SQLite database.
 *
 * The caller is responsible for connecting the returned server to a transport
 * (e.g. StdioServerTransport for CLI usage or WebStandardStreamableHTTPServerTransport
 * for HTTP usage).
 */
export function createMcpServer(db: Database): McpServer {
  const server = new McpServer(
    { name: "corpus-server", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        "Corpus Server is a Markdown knowledge-base server. Use the list_documents tool to discover available documents, search_documents to query by text or tags, and get_document to retrieve the full content of a specific document. Documents are identified by their slug (e.g. 'engineering/architecture'). Resources are addressable via corpus:// URIs.",
    },
  );

  registerTools(server, db);
  registerResources(server, db);

  return server;
}
