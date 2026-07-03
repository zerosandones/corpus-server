---
title: "Markdown Document Format"
description: "Summary of the format of the markdown frontmatter used in markdown documents"
created: "2026-07-03T09:22:00Z"
author: "David Glendenning <david.glendenning@zerosandones.dev>"
tags: [Summary, design ]
custom:
  version: "v1.0"
---

# Markdown Document Format

Every document stored on Corpus Server is a Markdown file with a YAML frontmatter block at the top. The frontmatter acts as the document's database record — it drives search indexing, access control, and AI-agent behaviour. The Markdown body that follows is the human-readable content.

---

## Structure

```markdown
---
title: "Example Document"
description: "A short summary of what this document covers."
created: 2026-06-01T09:00:00Z
updated: 2026-06-01T09:00:00Z
author: "Dave <dave@company.com>"
tags: [engineering, design, spec]
security:
  level: "internal"
  roles: ["engineering", "product"]
ai:
  priority: "high"
  ignore: false
  summary: "One-sentence description used by LLMs during indexing."
custom:
  version: "v1.0"
  status: "draft"
---

# Document Heading

Body content begins here.
```

The frontmatter block **must** be the very first thing in the file — no blank lines or whitespace before the opening `---`.

---

## Frontmatter Fields

### Core Fields

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | String | ✅ | Human-readable title. Defaults to the filename if omitted. |
| `description` | String | ✅ | A brief summary of the document's contents. Used in directory indexes and search results. |
| `created` | ISO 8601 | ✅ | Timestamp when the document was first published (e.g. `2026-06-01T09:00:00Z`). Set once and never changed. |
| `updated` | ISO 8601 | ✅ | Timestamp of the last revision. **Must be updated** on every `PUT` write. |
| `author` | String | — | Name and/or email of the document owner (e.g. `"Alice <alice@company.com>"`). |
| `tags` | Array\<String\> | — | List of lowercase strings for categorisation and search filtering. |

---

### `security` Object

Controls who may read the document. If omitted, the document falls back to the nearest `.acl.yaml` directory rule, or defaults to `private`.

```yaml
security:
  level: "confidential"
  roles: ["hr", "executive"]
  users: ["dave@company.com"]
```

| Key | Type | Description |
| :--- | :--- | :--- |
| `security.level` | `"public"` \| `"private"` \| `"confidential"` | Access tier. See the table below. |
| `security.roles` | Array\<String\> | Role names permitted when level is `confidential`. |
| `security.users` | Array\<String\> | Individual user IDs or emails permitted when level is `confidential`. |

**Security levels:**

| Level | Auth Required | Who can read |
| :--- | :---: | :--- |
| `public` | No | Anyone, including anonymous requests. |
| `private` | Yes | Any authenticated user or agent with a valid token. |
| `confidential` | Yes | Only token holders whose role or identity matches `roles` / `users`. |

---

### `ai` Object

Hints for LLMs, indexing pipelines, and automated agents.

```yaml
ai:
  priority: "high"
  ignore: false
  summary: "One-sentence description used by LLMs during indexing."
```

| Key | Type | Description |
| :--- | :--- | :--- |
| `ai.priority` | `"high"` \| `"medium"` \| `"low"` | How prominently to weight this document in search and context windows. |
| `ai.ignore` | Boolean | When `true`, the document is excluded from all search indexes and AI context. |
| `ai.summary` | String | A concise, single-sentence description written specifically for LLM consumption during indexing. |

---

### `custom` Object

A free-form key-value namespace for any organisational metadata that doesn't fit the standard schema. All keys must use `camelCase`.

```yaml
custom:
  version: "v2.1"
  status: "approved"
  reviewedBy: "alice@company.com"
```

There are no reserved keys inside `custom`, but avoid duplicating fields that already exist at the top level (`title`, `tags`, etc.).

---

## Minimal Valid Document

If you only need the required fields:

```markdown
---
title: "Meeting Notes — 2026-06-10"
description: "Notes from the weekly engineering sync."
created: 2026-06-10T10:00:00Z
updated: 2026-06-10T10:00:00Z
---

# Meeting Notes — 2026-06-10

...
```

---

## Rules & Conventions

- **Always update `updated`** when writing a document. The server sets this on every `PUT`, but include it correctly when crafting raw content.
- **Dates must be ISO 8601** with a UTC timezone suffix (`Z` or `+00:00`). Do not use locale-specific date strings.
- **`tags` should be lowercase** and hyphenated for multi-word values (e.g. `api-design`, `getting-started`).
- **Do not mix `camelCase` and `snake_case`** in the same frontmatter document. The standard is `camelCase` for all keys.
- **Always `GET` before `PUT`**. Read the current frontmatter before writing to avoid accidentally clearing fields you didn't intend to change.
