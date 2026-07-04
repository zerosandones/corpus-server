---
title: "Document Indexing"
description: "Out lines how the documents stored in the server are indexed for faster searching of documents"
created: 2026-06-04T10:50:00Z
author: David Glendenning <david.glendenning@zerosandones.dev>
tags: [summary, design, index]
custom:
  version: "v1.0"
---

# Document Indexing

Corpus server will act as an mcp server for A.I work flows, for focused and fast retrieval of documents, the server will index the fontmatter of all documents saved to the server.

## Indexing

The index for each file is saved in an embedded database on the server. 

### Indexing Process

Currently as there is no way to save, update or delete a document via the API, each time the server starts up it will index all the saved documents. The index will process each document saved to the document folder and all child folders. If a file has been removed then the index entry is also removed.

### A.I frontmatter

The frontmatter in each document can have an `ai` object which will affect the indexing.

| key | effect |
| --------- | -------- |
| ignore | True: the document is **not** indexed, otherwise it is |

### Indexed Fields

The following fields are indexed:

| field | notes |
| --------- | -------- |
| slug | Unique document path identifier |
| title | |
| description | |
| created | |
| updated | |
| author | |
| tags | Each tag is stored separately in a join table for efficient tag-based queries |
| security.level | |
| security.roles | Stored as a JSON array |
| security.users | Stored as a JSON array |
| ai.priority | |
| ai.ignore | |
| ai.summary | |
| custom | Stored as a JSON object |