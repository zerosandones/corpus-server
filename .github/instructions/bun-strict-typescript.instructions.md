---
description: "Use when writing or modifying Bun server code, TypeScript modules, request handlers, tests, scripts, or runtime integrations in this repository. Enforces Bun-first APIs and strict TypeScript patterns."
name: "Bun Strict TypeScript"
applyTo: "**/*.ts"
---

# Bun Strict TypeScript

- Treat this repository as a Bun runtime project. Prefer Bun-native APIs and Bun-compatible libraries; use Node-specific implementations only when there is a clear reason.
- Write all code in strict TypeScript that satisfies the current `tsconfig.json` without weakening compiler options.
- Do not introduce `any`, `@ts-ignore`, or type assertions unless there is no practical typed alternative and the reason is explicit in the code.
- Keep ESM-style imports and exports consistent with the existing TypeScript configuration.
- Prefer explicit, validated parsing of request inputs and environment values instead of relying on unchecked casts.
- Keep server code small and typed: extract helpers when request handling, response shaping, or document loading logic starts to branch.