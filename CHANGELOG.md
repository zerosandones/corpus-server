# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `GET /` — lists all markdown documents in the `documents/` folder, returning a formatted markdown index with document titles and frontmatter metadata
- `GET /*` — reads and returns a markdown document by path from the `documents/` folder, fulls back to folder index if path is a directory
- Slug validation on all request paths to block path traversal and invalid characters (`400 Bad Request`)
- Standardised JSON error payloads with `code`, `message`, `path`, and `timestamp` fields for `400`, `404`, and `500` responses
- `parseFrontmatter` utility — parses YAML frontmatter blocks from markdown content, supporting scalar values and inline arrays
- `StorageService` — `getDocument` reads a markdown file by slug, `getDir` lists folder contents with parsed frontmatter and resolved titles (frontmatter `title` field, then first H1 heading)
- URL utilities — `parseRequestUrl`, `getServerUrl`, and `getRequestPath` for extracting server origin and path from request URLs
- Unit tests for `parseFrontmatter` and `StorageService` using `bun:test`
- `bun test` script in `package.json`
