import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import { indexDirectory } from "./modules/index/service";
import { storage } from "./modules/storage";
import { mcpServer } from "./modules/mcp";
import { initDb } from "./modules/index/db";

// Initialise the document index once at startup.
console.log("=======Initialising document index...=======");
const db = new Database(":memory:");
initDb(db);
await indexDirectory(db);
console.log("======Document index initialised.=======");

const app = new Elysia();
app.use(storage);
app.use(mcpServer(db));

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
