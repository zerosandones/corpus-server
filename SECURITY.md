# Security Policy

## Supported Versions

corpus-server is currently in early development. Only the latest commit on the `main` branch receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest (`main`) | ✅ |
| older commits | ❌ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in corpus-server, report it privately using one of the following methods:

- **GitHub Security Advisories** – open a [private security advisory](https://github.com/zerosandones/corpus-server/security/advisories/new) via the *Security* tab of this repository. This is the preferred channel.
- **Email** – if you cannot use the advisory form, contact the maintainers at the email address listed in the repository profile.

Include as much of the following as you can to help us reproduce and triage the issue quickly:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (PoC)
- The version or commit SHA you tested against
- Any relevant logs, payloads, or screenshots

## Response Timeline

We aim to acknowledge receipt of your report **within 3 business days** and to provide an initial assessment **within 7 business days**. Fixes for confirmed vulnerabilities will be prioritised and released as soon as is practical.

We will keep you informed of progress throughout the process.

## Scope

The following areas are in scope for security reports:

- **Path-traversal / directory-traversal** – the server resolves document slugs to filesystem paths; any bypass that allows reading files outside the `documents/` directory is a critical concern.
- **Denial-of-service via crafted requests** – inputs that cause the server to hang, crash, or consume excessive resources.
- **Information disclosure** – unintended exposure of file contents, server internals, or environment variables.
- **Dependency vulnerabilities** – known CVEs in direct dependencies (`bun`, `typescript`) that affect the running server.
- **Container / Docker image** – vulnerabilities in the published Docker image or its base image layers.

The following are **out of scope**:

- Vulnerabilities in client tooling, editors, or third-party integrations not maintained in this repository.
- Findings that require physical access to the host machine.
- Reports that assume a misconfigured deployment (e.g., running as root without the provided Docker image).
- Social-engineering attacks against maintainers.

## Disclosure Policy

Once a fix has been released we follow **coordinated disclosure**: the reporter is credited (with their consent) in the security advisory, and details of the vulnerability are made public no sooner than 14 days after the fix is available.

## Security Design Notes

- The server resolves document slugs directly to the filesystem via `storage.ts`. Only single-segment path names that contain no path separators are accepted (`/^\/([^/]+)$/`).
- Documents are served as `text/markdown` with an explicit UTF-8 charset; no HTML rendering is performed by the server itself.
- The production Docker image uses a **distroless** base (`oven/bun:1-distroless`), which minimises the attack surface by shipping no shell or package manager.
- The server reads `PORT` from the environment; all other configuration should be supplied through environment variables and never committed to the repository.
