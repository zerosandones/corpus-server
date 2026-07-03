import { Elysia } from "elysia";
import { isValidSlug } from "../../utils/slug-check";
import { parseRequestUrl } from "../../utils/url";
import { getDocument, getDir, FolderEntry } from "./service";

interface ErrorPayload {
  code: string;
  message: string;
  path: string;
  timestamp: string;
}

function formatFolderIndex(heading: string, entries: FolderEntry[]): string {
  const lines = [`# ${heading}`, ""];
  for (const entry of entries) {
    const baseName = entry.slug.split("/").pop() ?? entry.slug;
    const label = entry.title ?? baseName;
    lines.push(`- [${label}](/${entry.slug})`);
    if (entry.frontmatter) {
      for (const [key, value] of Object.entries(entry.frontmatter)) {
        const display = Array.isArray(value) ? value.join(", ") : value;
        lines.push(`  - ${key}: ${display}`);
      }
    }
  }
  return lines.join("\n");
}

const rootHandler = async ({
  request,
}: {
  request: Request;
}): Promise<Response> => {
  console.log("Received request:", request.method, request.url);

  try {
    const folderEntries = await getDir();
    if (!folderEntries) {
      return new Response("No entries found.", {
        status: 204,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(formatFolderIndex("Index /", folderEntries), {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error reading directory:", error);
    const errorPayload: ErrorPayload = {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred while reading the directory.",
      path: "/",
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(errorPayload), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

const documentHandler = async ({
  request,
}: {
  request: Request;
}): Promise<Response> => {
  console.log("Received request:", request.method, request.url);
  const { pathname } = parseRequestUrl(request.url);
  const isValid = isValidSlug(pathname);
  if (!isValid) {
    const errorPayload: ErrorPayload = {
      code: "BAD_REQUEST",
      message: "Invalid slug - path traversal or invalid characters detected",
      path: pathname,
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(errorPayload), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const fileContent = await getDocument(pathname);

    if (fileContent === null) {
      console.log(`Document not found: ${pathname}. Checking for directory index...`);

      const folderEntries = await getDir(pathname);
      if (folderEntries && folderEntries.length > 0) {
        console.log(`Directory index found for: ${pathname}`);
        return new Response(formatFolderIndex(`Index /${pathname}`, folderEntries), {
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }

      console.log(`No directory index found for: ${pathname}`);
      const errorPayload: ErrorPayload = {
        code: "NOT_FOUND",
        message: `The requested document '${pathname}' does not exist.`,
        path: pathname,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(errorPayload), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default to markdown
    return new Response(fileContent, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error reading file:", error);
    const errorPayload: ErrorPayload = {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred while reading the document.",
      path: pathname,
      timestamp: new Date().toISOString(),
    };
    return new Response(JSON.stringify(errorPayload), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const storage = new Elysia()
  .get("/", rootHandler)
  .get("/*", documentHandler);
