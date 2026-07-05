import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import { createMcpServer } from "./server";

export const mcpServer = (db: Database) => new Elysia({prefix: "/_mcp"})
  .post("/", async ({ request }): Promise<Response> => {
    console.log("Received request:", request.method, request.url);
    
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = createMcpServer(db);
    await mcpServer.connect(transport);
    return transport.handleRequest(request);
  });
