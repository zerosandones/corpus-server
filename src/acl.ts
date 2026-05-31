import { parse as parseYaml } from "yaml";
import type { Config } from "./config.ts";
import path from "path";

export interface AclSecurity {
  level?: "public" | "private" | "confidential";
  roles?: string[];
  users?: string[];
}

export interface AclConfig {
  security?: AclSecurity;
}

export interface CallerIdentity {
  sub: string;
  type: "human" | "agent";
  roles: string[];
}

export function resolveStaticToken(
  token: string,
  configTokens: Config["auth"]["tokens"]
): CallerIdentity | null {
  if (!configTokens) return null;
  const entry = configTokens.find((t) => t.token === token);
  if (!entry) return null;
  return { sub: entry.sub, type: entry.type, roles: entry.roles };
}

export async function loadAclForPath(
  filePath: string,
  storageRoot: string
): Promise<AclConfig> {
  const absStorage = path.resolve(storageRoot);
  let dir = path.dirname(path.resolve(filePath));
  let merged: AclConfig = {};

  const dirs: string[] = [];
  while (dir.startsWith(absStorage)) {
    dirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Walk from storage root down to file dir (closest wins)
  for (const d of dirs.reverse()) {
    const aclPath = path.join(d, ".acl.yaml");
    const file = Bun.file(aclPath);
    if (await file.exists()) {
      try {
        const text = await file.text();
        const parsed = parseYaml(text) as AclConfig;
        merged = deepMerge(merged, parsed);
      } catch {
        // ignore malformed ACL files
      }
    }
  }
  return merged;
}

export function checkAccess(
  docSecurity: AclSecurity | undefined,
  folderAcl: AclConfig,
  caller: CallerIdentity | null
): true | "unauthorized" | "forbidden" {
  const security: AclSecurity =
    docSecurity ?? folderAcl.security ?? { level: "private" };
  const level = security.level ?? "private";

  if (level === "public") return true;

  if (!caller) return "unauthorized";

  if (level === "private") return true;

  // confidential: check roles or users
  const allowedRoles = security.roles ?? [];
  const allowedUsers = security.users ?? [];
  const hasRole = allowedRoles.some((r) => caller.roles.includes(r));
  const hasUser = allowedUsers.includes(caller.sub);
  if (hasRole || hasUser) return true;

  return "forbidden";
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const val = override[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      result[key] = deepMerge((base[key] ?? {}) as object, val as object) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}
