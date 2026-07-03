import { Elysia } from "elysia";
import { storage } from "./modules/storage";

const app = new Elysia();
app.use(storage);

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
