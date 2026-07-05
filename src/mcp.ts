import { Database } from "bun:sqlite";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initDb } from "./modules/index/db";
import { indexDirectory } from "./modules/index/service";
import { createMcpServer } from "./modules/mcp/server";

async function main(): Promise<void> {
  const db = new Database(":memory:");
  initDb(db);
  await indexDirectory(db);

  const server = createMcpServer(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
