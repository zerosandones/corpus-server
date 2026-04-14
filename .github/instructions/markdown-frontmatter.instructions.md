---
description: "Use when creating or editing Markdown documents served by this repository, especially files under documents/ with YAML frontmatter metadata headers. Covers document structure, frontmatter handling, and content consistency."
name: "Markdown Frontmatter Documents"
applyTo: "documents/**/*.md"
---

# Markdown Frontmatter Documents

- Treat documents in this repository as Markdown content files with a YAML frontmatter header at the top of the file.
- Keep the frontmatter valid YAML and separate it from the Markdown body using the standard triple-dash delimiters.
- Treat document frontmatter as stable application data, not free-form notes.
- Require each served document to define `title`, `slug`, and `security` in frontmatter.
- Keep `title` as a concise human-readable string suitable for display.
- Keep `slug` as a stable lowercase kebab-case identifier. Do not include spaces, file extensions, query strings, or leading and trailing slashes.
- Keep `security` as a single string value from the repository's approved classification vocabulary. Do not invent new security labels inside individual documents.
- Preserve existing metadata keys and naming when updating a document. Reuse an existing optional key before adding a new one, and keep the same type for the same key across documents.
- Keep frontmatter values structured and machine-readable. Prefer strings, booleans, arrays, and ISO 8601 date strings over prose embedded in metadata.
- Use arrays for repeatable metadata such as tags or related identifiers rather than comma-delimited strings.
- Keep the Markdown body focused on document content, not duplicated metadata. Document titles, summaries, tags, and publish data belong in frontmatter when relevant.
- Do not leave malformed or partial frontmatter blocks. If metadata is unknown, omit the key rather than guessing.
- When renaming a schema field or changing a field type, update the whole document set and any server code that consumes that field together.

## Security Values

The security tag is used to provide a consistent classification of the document's content and intended audience. Use one of the following values:

* `public`: Content is safe for public consumption and does not contain sensitive information.
* `internal`: Content is intended for internal use within the organization and may contain non-public information
* `confidential`: Content contains sensitive information that should only be shared with a limited audience and requires special handling.