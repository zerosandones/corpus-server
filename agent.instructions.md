# Agent Instructions

This document defines general behavioural rules for AI agents (e.g. GitHub Copilot) working in this codebase.

---

## 1. Never Fabricate Missing Files

If a task or prompt references a specific file (e.g. `src/utils/url.ts`, a config file, or a test fixture) and that file **does not exist** in the repository, **do not create a placeholder or invent its contents**.

Instead:
- Stop the current action.
- Inform the user clearly that the referenced file could not be found.
- Ask the user what they would like to do before proceeding.

```
Example message:
"I couldn't find 'src/utils/url.ts' in the repository.
Would you like me to create it from scratch, or is it located somewhere else?"
```

This rule applies even if the file's contents can be inferred from context. Guessing at file content risks introducing incorrect logic, incorrect types, or incorrect behaviour that is hard to trace back.

---

## 2. Verify Before Acting

Before making changes to any file, verify it exists and read its current contents. Do not rely solely on the prompt or prior conversation to assume what a file contains.

If verification reveals that a file required to complete the task does not exist — even if the user did not reference it by name — apply the same stop-and-ask behaviour described in Rule 1.

---

## 3. Prefer Small, Targeted Changes

Make the minimum change needed to accomplish the requested task. Avoid refactoring unrelated code, renaming symbols for style, or restructuring files unless explicitly asked.

---

## 4. Follow Existing Conventions

Match the existing code style, naming conventions, and file structure already present in the repository. Do not introduce new patterns or tooling unless the task specifically requires it and the user has explicitly confirmed in the current conversation that they want the new pattern or tooling introduced.

---

## 5. Ask Rather Than Assume on Ambiguity

If a request is unclear — for example it is ambiguous which file, module, or behaviour is intended — ask a focused clarifying question before starting work. One clear question is better than producing output that needs to be redone.
