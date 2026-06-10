# Contributing to Corpus Server

Thank you for your interest in contributing! This document covers how to report issues, propose features, and submit code or document changes.

## Reporting Bugs

Open an issue using the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template. Include clear reproduction steps, expected behaviour, and any relevant logs or screenshots.

## Requesting Features

Open an issue using the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template. Frame your request as a user story and list acceptance criteria so the scope is clear before any code is written.

## Development Setup

Corpus Server runs on the [Bun](https://bun.sh) runtime. You will need Bun installed locally.

```sh
# Install dependencies
bun install

# Start the server
bun run start

# Run all tests
bun test
```

The server listens on `PORT` when that environment variable is set, or `8080` by default. Markdown documents are served from the `documents/` directory at the repository root (created automatically on first start).

## Code Style

- Write all source files in strict TypeScript that satisfies `tsconfig.json` without weakening compiler options.
- Prefer Bun-native APIs. Use Node-specific APIs only when Bun has no equivalent.
- Do not introduce `any`, `@ts-ignore`, or unsafe type assertions.
- Keep ESM-style imports consistent with the existing configuration.
- Validate request inputs and environment values explicitly instead of relying on unchecked casts.

## Adding or Editing Documents

Documents live in the `documents/` directory as Markdown files. Each file must include a YAML frontmatter block with these required fields:

| Field      | Type   | Description                                                      |
|------------|--------|------------------------------------------------------------------|
| `title`    | string | Concise human-readable title for display.                        |
| `slug`     | string | Stable lowercase kebab-case identifier (no spaces or slashes).   |
| `security` | string | Classification: `public`, `internal`, or `confidential`.         |

```markdown
---
title: My Document
slug: my-document
security: public
---

Document body goes here.
```

- The `slug` value must match the file name (without the `.md` extension) and must pass the kebab-case pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Use arrays for repeatable metadata (tags, related identifiers) rather than comma-delimited strings.
- Keep frontmatter values structured and machine-readable; prose belongs in the document body.

## Submitting a Pull Request

1. Fork the repository and create a branch from `main`.
2. Make your changes and ensure all tests pass: `bun test`.
3. Open a pull request against `main`. The CI workflow runs the full test suite on every push and pull request — your PR must be green before it can be merged.
4. Describe what changed and why in the pull request description.

## Licence

By contributing you agree that your contributions will be licensed under the [MIT Licence](LICENSE).
