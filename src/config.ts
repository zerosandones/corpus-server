import { parse as parseYaml } from "yaml";

export interface Config {
  server: { host: string; port: number };
  storage: { root: string; assetsDir: string };
  database: { type: "persistent" | "in-memory"; path: string };
  auth: {
    type: "static" | "jwt" | "forward-auth" | "none";
    jwtSecret?: string;
    tokens?: Array<{
      token: string;
      sub: string;
      type: "human" | "agent";
      roles: string[];
    }>;
  };
}

const defaults: Config = {
  server: { host: "0.0.0.0", port: 3000 },
  storage: { root: "./storage", assetsDir: "_assets" },
  database: { type: "in-memory", path: ":memory:" },
  auth: { type: "none" },
};

export async function loadConfig(configPath = "./config.yaml"): Promise<Config> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    console.warn(`[config] ${configPath} not found, using defaults`);
    return defaults;
  }
  const text = await file.text();
  const parsed = parseYaml(text) as Partial<Config>;
  return {
    server: { ...defaults.server, ...parsed.server },
    storage: { ...defaults.storage, ...parsed.storage },
    database: { ...defaults.database, ...parsed.database },
    auth: { ...defaults.auth, ...parsed.auth },
  };
}
