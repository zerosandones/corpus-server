import type { BunRequest } from "bun";
import { ensureDocsDir } from "./storage";

console.log("Starting server...");

console.log("Checking data directory...")
await ensureDocsDir();
console.log("Data directory is ready.");

const server = Bun.serve({

  port: Number(process.env.PORT) || 8080,


  //default handler for all unmatched routes
  fetch(req) {
    
    return new Response("Not found", { status: 404 });
  }

})
console.log(`corpus-server listening on http://localhost:${server.port}`);

export default server;