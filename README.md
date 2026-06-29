# Loops Desktop

A hotkey-driven command bar for browsing, creating, and injecting reusable AI
assets into the AI apps you already use (Claude Code, Cursor, Codex, Gemini CLI,
OpenCode). Inspired by the agent-loop catalog at
[loops.elorm.xyz](https://loops.elorm.xyz/), reimagined as a local-first desktop
app with a Raycast/Alfred-style quick panel.

> **Status: M0 + M1.** This milestone ships the app skeleton and an end-to-end
> **Loop** workflow (local library CRUD + `/` command run + clipboard injection).
> Other asset kinds, the `@ # !` trigger providers, foreground-app scope
> filtering, and the public marketplace are planned for later milestones.

## Core concept: Assets

Everything reusable is modeled as an **Asset**, discriminated by `kind`
(`loop | prompt | context | command | persona | snippet | rule`). Only `loop`
is implemented today; new kinds are added by introducing a new payload type and
an editor/renderer — the core store, types, and command bar stay unchanged.

A **Loop** is a goal-directed iterative routine: `goal`, `instructions`, an
optional `stopCondition`, `maxIterations`, and template `variables` that are
filled in just before injection.

## Architecture

| Layer | Tech | Responsibility |
|-------|------|----------------|
| Backend | Rust (Tauri v2) | SQLite persistence (`store.rs`), OS bridge for hotkey/foreground/clipboard (`osbridge.rs`), IPC commands (`commands.rs`) |
| Frontend | React 19 + TypeScript + Vite | Library window (browse/CRUD) and frameless Command Bar (hotkey-summoned search + inject) |

- **Library window** — browse the local loop collection, create/edit/delete,
  view loop detail with a live rendered preview.
- **Command Bar** — summoned by a global hotkey (`Alt+Space`), filters loops by
  query or trigger (`/`), collects variable values, and injects the rendered
  text via the clipboard.

The frontend/backend contract is a single `Asset` shape serialized as camelCase
JSON (`src/types/asset.ts` mirrors `src-tauri/src/model.rs`).

## Develop

Prerequisites: Node 20+, Rust stable, and the platform's Tauri prerequisites
(on Windows: MSVC build tools + WebView2 runtime).

```bash
npm install
npm run tauri dev     # launch the desktop app in dev mode
```

Useful checks:

```bash
npm run typecheck     # tsc --noEmit
npm run build         # tsc && vite build (frontend bundle)
cd src-tauri && cargo check
```

## Project layout

```
src/                 React frontend
  types/asset.ts     Asset/Loop type contract (mirrors Rust model)
  lib/               IPC wrappers, template render, draft helpers, app catalog
  views/             LibraryApp, CommandBar
  components/        LoopCard, LoopDetail, LoopEditor, VariableForm
src-tauri/src/       Rust backend
  model.rs           Asset/LoopPayload/VariableSpec/TriggerBinding/ScopeRule
  store.rs           SQLite persistence (rusqlite)
  commands.rs        Tauri IPC command handlers
  osbridge.rs        Foreground-app detection (M1 stub)
  lib.rs             App setup: tray, global hotkey, windows
```
