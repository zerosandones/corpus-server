import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { initDb } from "./modules/index/db";
import { indexDirectory } from "./modules/index/service";
import { createMcpServer } from "./modules/mcp/server";
import { storage } from "./modules/storage";

// Initialise the document index once at startup.
const db = new Database(":memory:");
initDb(db);
await indexDirectory(db);

// Create a single stateless MCP server instance shared across all HTTP requests.
const mcpServer = createMcpServer(db);

const app = new Elysia();
app.use(storage);

// MCP Streamable HTTP endpoint — handles JSON-RPC requests from AI clients.
app.post("/_mcp", async ({ request }) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });
  await mcpServer.connect(transport);
  return transport.handleRequest(request);
});

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
