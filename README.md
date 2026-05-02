# Corpus Server

[![Test](https://github.com/zerosandones/corpus-server/actions/workflows/commit-tests.yml/badge.svg)](https://github.com/zerosandones/corpus-server/actions/workflows/commit-tests.yml)

Create markdown knowledge libraries for you, your team, your organisation, your A.I.

Knowledge is more important than, Corpus server is the web server for the Web 1+ era. Dealing with markdown documents we allow for easier display and understanding of these structured documents by people and machine.

## API Authentication

Write operations (POST and PUT) require a valid API key supplied as a Bearer token:

```
Authorization: Bearer <your-raw-key>
```

API keys are configured via the `API_KEYS` environment variable. Its value must be a JSON array of key records:

```json
[
  {
    "id": "my-agent",
    "keyHash": "<sha256-hex-of-raw-key>",
    "scopes": ["write"]
  }
]
```

* **`id`** — a human-readable label for the caller (logged on each request).
* **`keyHash`** — the SHA-256 hex digest of the raw bearer token. Never store the raw key; only record the hash.
* **`scopes`** — list of permissions granted. Use `"write"` to allow POST and PUT.

To generate a key hash (Unix):

```sh
echo -n "my-secret-key" | sha256sum
```

Read access (GET) is public and does not require authentication.

## Why Markdown

In knowledge bases markdown has several advantages over other markup languages like html

* Markdown was designed as a "writing format." Its syntax (e.g., # for headers, * for lists) mimics natural language, making it easier for humans to read.
* For Large Language Models (LLMs), Markdown is the superior format. It is more token-efficient, meaning it uses fewer processing units (tokens) to represent the same information, reducing API costs and allowing more data to fit into a model's context window.
*  Markdown forces a clean hierarchy. Because it lacks the "noise" of <div> or <span> tags, AI models can better identify relationships between data points, such as tabular data.
