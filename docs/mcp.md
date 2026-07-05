---
title: "MCP Server Integration"
description: "How to use Corpus Server as an MCP (Model Context Protocol) server with AI clients such as Claude Desktop and VS Code."
created: 2026-07-04T12:00:00Z
updated: 2026-07-04T12:00:00Z
author: "Corpus Server"
tags: [mcp, ai, integration, design]
custom:
  version: "v1.0"
---

# MCP Server Integration

Corpus Server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), allowing AI clients to discover, search, and read documents directly. Two transport modes are supported:

| Mode | Transport | Use case |
| :--- | :--- | :--- |
| **stdio** | Process stdin/stdout | Claude Desktop, local CLI agents |
| **HTTP** | `POST /_mcp` | Remote agents, VS Code extensions, custom clients |

---

## Transports

### stdio (Subprocess)

Run Corpus Server as a subprocess directly from your AI client:

```bash
bun run mcp
```

The process reads JSON-RPC messages from `stdin` and writes responses to `stdout`. The document index is built from the `documents/` folder at startup.

### HTTP (Streamable HTTP)

When the main HTTP server is running (`bun run dev`), the MCP endpoint is available at:

```
POST http://localhost:3000/_mcp
```

Each POST request is handled statelessly — no session ID is required.

---

## Configuring Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "corpus": {
      "command": "bun",
      "args": ["run", "mcp"],
      "cwd": "/path/to/corpus-server"
    }
  }
}
```

Replace `/path/to/corpus-server` with the absolute path to your Corpus Server installation.

---

## Configuring VS Code (HTTP transport)

When the HTTP server is running, configure your MCP client to send requests to:

```
http://localhost:3000/_mcp
```

No additional headers are required for stateless operation.

---

## Tools Reference

### `list_documents`

Returns all indexed, non-ignored documents. Optionally scoped to a directory prefix.

**Input schema:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `scope` | `string` | — | Directory prefix to filter results (e.g. `"engineering"` or `"engineering/design"`). |

**Example response:**

```json
[
  {
    "slug": "engineering/architecture",
    "title": "Architecture Guide",
    "description": "Overview of the system architecture.",
    "tags": ["architecture", "engineering"]
  }
]
```

---

### `get_document`

Fetches the full raw Markdown content of a single document, including YAML frontmatter.

**Input schema:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `slug` | `string` | ✅ | Document path without `.md` extension (e.g. `"engineering/architecture"`). |

**Error codes:**

| Code | Meaning |
| :--- | :--- |
| `BAD_REQUEST` | The slug contains invalid characters or path traversal sequences. |
| `NOT_FOUND` | No document exists at the given slug. |

---

### `search_documents`

Searches indexed documents by a text query and/or one or more tags. Results are merged and deduplicated. When neither `query` nor `tags` are provided, all indexed documents are returned.

**Input schema:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `query` | `string` | — | Case-insensitive substring matched against `title` and `description`. |
| `tags` | `string[]` | — | One or more tags. Documents matching any tag are included. |

**Example response:**

```json
[
  {
    "slug": "engineering/architecture",
    "title": "Architecture Guide",
    "description": "Overview of the system architecture.",
    "tags": ["architecture", "engineering"]
  }
]
```

---

## Resources Reference

Documents are also accessible as MCP **resources** using the `corpus://` URI scheme.

### URI format

```
corpus://{slug}
```

**Examples:**

| URI | Document |
| :--- | :--- |
| `corpus://engineering/architecture` | `documents/engineering/architecture.md` |
| `corpus://getting-started` | `documents/getting-started.md` |

### `resources/list`

Returns descriptors for all indexed, non-ignored documents:

```json
{
  "resources": [
    {
      "uri": "corpus://engineering/architecture",
      "name": "Architecture Guide",
      "description": "Overview of the system architecture.",
      "mimeType": "text/markdown"
    }
  ]
}
```

### `resources/read`

Returns the raw Markdown content of the document at the given URI:

```json
{
  "contents": [
    {
      "uri": "corpus://engineering/architecture",
      "mimeType": "text/markdown",
      "text": "---\ntitle: \"Architecture Guide\"\n...\n"
    }
  ]
}
```

---

## Security & Privacy

- Documents with `ai.ignore: true` in their frontmatter are **never indexed** and will not appear in any MCP tool or resource response.
- Use the `security.level` frontmatter field to declare sensitivity. The current MCP integration does not enforce ACL — all indexed documents are accessible. Access control enforcement is planned for a future release.
- Run the HTTP server behind a reverse proxy (e.g. nginx) with authentication if exposing `/_mcp` publicly.
