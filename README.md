# Corpus Server

[![Test](https://github.com/zerosandones/corpus-server/actions/workflows/commit-tests.yml/badge.svg)](https://github.com/zerosandones/corpus-server/actions/workflows/commit-tests.yml)

Create markdown knowledge libraries for you, your team, your organisation, your A.I.

Knowledge is more important than, Corpus server is the web server for the Web 1+ era. Dealing with markdown documents we allow for easier display and understanding of these structured documents by people and machine.

## Why Markdown

In knowledge bases markdown has several advantages over other markup languages like html

* Markdown was designed as a "writing format." Its syntax (e.g., # for headers, * for lists) mimics natural language, making it easier for humans to read.
* For Large Language Models (LLMs), Markdown is the superior format. It is more token-efficient, meaning it uses fewer processing units (tokens) to represent the same information, reducing API costs and allowing more data to fit into a model's context window.
*  Markdown forces a clean hierarchy. Because it lacks the "noise" of <div> or <span> tags, AI models can better identify relationships between data points, such as tabular data.

## Encryption at Rest

Document bodies are encrypted on disk using **AES-256-GCM**. Each document's YAML frontmatter is stored in plaintext (so folder listings work without the key), while the body is stored as an authenticated ciphertext token.

### Providing the encryption key

The server resolves the key from one of two sources (checked in this order):

| Method | How to use | Security notes |
|---|---|---|
| **`ENCRYPTION_KEY_FILE`** (recommended) | Set to the path of a file containing the 64-character hex key | Key is never an environment variable; not visible via `docker inspect` or `/proc/self/environ` |
| **`ENCRYPTION_KEY`** | Set to the 64-character hex key directly | Convenient for local development; less secure because env vars are visible to all processes running as the same user and via container inspection |

The key must be a 64-character hexadecimal string (32 bytes, AES-256). Generate one with:

```sh
openssl rand -hex 32
```

### Docker secrets (recommended for production)

Docker secrets are mounted as files under `/run/secrets/` and are **not** exposed as environment variables or via `docker inspect`:

```sh
# Create the secret
echo "$(openssl rand -hex 32)" | docker secret create corpus_encryption_key -

# Reference it in your service
docker service create \
  --secret corpus_encryption_key \
  --env ENCRYPTION_KEY_FILE=/run/secrets/corpus_encryption_key \
  corpus-server
```

### Kubernetes secret volume mount

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: corpus-encryption-key
stringData:
  key: "<your-64-char-hex-key>"
---
# In your Pod/Deployment spec:
env:
  - name: ENCRYPTION_KEY_FILE
    value: /run/secrets/corpus-encryption-key/key
volumeMounts:
  - name: encryption-key
    mountPath: /run/secrets/corpus-encryption-key
    readOnly: true
volumes:
  - name: encryption-key
    secret:
      secretName: corpus-encryption-key
```

### Local development only

```sh
ENCRYPTION_KEY=<your-64-char-hex-key> bun run src/server.ts
```
