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

const app = new Elysia();
app.use(storage);

// MCP Streamable HTTP endpoint — handles JSON-RPC requests from AI clients.
// A fresh McpServer and transport are created per request so that each
// stateless request gets its own isolated connection lifecycle, which is the
// recommended pattern for the WebStandardStreamableHTTPServerTransport stateless
// mode and avoids transport state conflicts under concurrent load.
app.post("/_mcp", async ({ request }) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });
  const mcpServer = createMcpServer(db);
  await mcpServer.connect(transport);
  return transport.handleRequest(request);
});

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
