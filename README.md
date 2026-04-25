# Corpus Server

[![Test](https://github.com/zerosandones/corpus-server/actions/workflows/commit-tests.yml/badge.svg)](https://github.com/zerosandones/corpus-server/actions/workflows/commit-tests.yml)

Create markdown knowledge libraries for you, your team, your organisation, your A.I.

Knowledge is more important than, Corpus server is the web server for the Web 1+ era. Dealing with markdown documents we allow for easier display and understanding of these structured documents by people and machine.

## Why Markdown

In knowledge bases markdown has several advantages over other markup languages like html

* Markdown was designed as a "writing format." Its syntax (e.g., # for headers, * for lists) mimics natural language, making it easier for humans to read.
* For Large Language Models (LLMs), Markdown is the superior format. It is more token-efficient, meaning it uses fewer processing units (tokens) to represent the same information, reducing API costs and allowing more data to fit into a model's context window.
*  Markdown forces a clean hierarchy. Because it lacks the "noise" of <div> or <span> tags, AI models can better identify relationships between data points, such as tabular data.

## How It Works

Corpus Server is a minimal HTTP server built on [Bun](https://bun.sh). It serves Markdown documents from the local filesystem in response to URL requests.

### Request Flow

1. A client sends a `GET` request to `/<slug>` (e.g., `GET /my-document`).
2. The server validates the slug — it must be lowercase kebab-case (letters, numbers, and hyphens only, no leading/trailing/consecutive hyphens).
3. If the slug is valid, the server looks for a file at `documents/<slug>.md` on disk.
4. If the file exists, its raw Markdown content is returned with `Content-Type: text/markdown; charset=utf-8` and a `200` status.
5. Any other route, or a slug that fails validation or has no matching file, returns `404 Not found`.

### Project Structure

```
corpus-server/
├── src/
│   ├── server.ts        # Bun HTTP server — routing and request handling
│   └── storage.ts       # Filesystem helpers — slug validation and document lookup
├── documents/           # Created at runtime; place your .md files here
├── Dockerfile           # Multi-stage Docker build (builder → distroless image)
├── package.json
└── tsconfig.json
```

### Document Format

Documents are plain Markdown files stored in the `documents/` directory. Each file should include a YAML frontmatter block at the top:

```markdown
---
title: My Document
slug: my-document
security: public
---

# My Document

Content goes here.
```

Required frontmatter fields:

| Field      | Description                                                                  |
| ---------- | ---------------------------------------------------------------------------- |
| `title`    | Human-readable display name for the document.                                |
| `slug`     | Stable kebab-case identifier — must match the filename (without `.md`).      |
| `security` | Classification label: `public`, `internal`, or `confidential`.               |

## Developer Onboarding

### Prerequisites

* **[Bun](https://bun.sh) v1+** — used as the runtime, package manager, bundler, and test runner.
* **TypeScript 5+** — the project is written in strict TypeScript; Bun transpiles it at runtime (no separate compile step needed for development).
* **Docker** *(optional)* — for building and running the containerised image.

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/zerosandones/corpus-server.git
cd corpus-server

# 2. Install dependencies
bun install

# 3. Start the server
bun run start
```

The server starts on port `8080` by default. Set the `PORT` environment variable to use a different port:

```bash
PORT=3000 bun run start
```

On first run the `documents/` directory is created automatically. Drop any `.md` files into it and they are immediately available via `GET /<slug>`.

### Running Tests

```bash
bun test
```

Tests live alongside source files (`*.test.ts`) and use [Bun's built-in test runner](https://bun.sh/docs/cli/test). The test suite covers server routing and slug-based document retrieval.

### Docker

Build and run the server inside a container:

```bash
# Build the image
docker build -t corpus-server .

# Run the container, mounting a local documents folder
docker run -p 8080:8080 -v "$(pwd)/documents:/app/documents" corpus-server
```

The Dockerfile uses a two-stage build: dependencies and source are compiled in a full Bun image, then copied into a minimal distroless image for the final artefact.

### Dev Container

The repository includes a [Dev Container](https://containers.dev/) configuration (`.devcontainer/devcontainer.json`) that pre-installs Bun, TypeScript, and the GitHub CLI. Open the repository in VS Code or GitHub Codespaces to get a fully configured development environment with no manual setup.
