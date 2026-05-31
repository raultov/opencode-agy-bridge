# opencode-agy-bridge

OpenCode plugin + provider that routes LLM prompts to `agy` (Google Antigravity CLI).

## How it works

```
opencode TUI
  └─ /model → select agy/antigravity
      └─ you type a prompt
          └─ provider spawns: agy --add-dir <cwd> [--conversation <id>] -p -
              └─ agy → Google Antigravity backend → Gemini
                  └─ stdout (buffered, full response)
              └─ provider extracts delta vs previous turn
          └─ text-delta + finish → opencode renders the response
```

## Prerequisites

1. **`agy` installed and authenticated** — run `agy` standalone at least once to complete OAuth.
2. **Node.js ≥ 18** or **Bun ≥ 1.0**.
3. **OpenCode** `>= 1.15.x` (uses Vercel AI SDK v3).

## Installation

### Automatic (hands-free)

Add the package with its version to `~/.config/opencode/opencode.json`. OpenCode will download and resolve it from npm automatically — no terminal commands needed.

### Manual global install

```bash
npm install -g opencode-agy-bridge
# or: bun install -g opencode-agy-bridge
# or: pnpm add -g opencode-agy-bridge
```

### Build from source

```bash
git clone https://github.com/raultov/opencode-agy-bridge.git
cd opencode-agy-bridge
bun install && bun run build && bun test
```

## Configuration

Add the plugin and provider to `~/.config/opencode/opencode.json`.

> The **node.js** path represents a **package** (directory or npm package name), not a `.js` file. Pointing `"npm"` at a `.js` file will cause a `ProviderInitError` because opencode internally appends `/provider` to resolve the exports map.

### Recommended: automatic from npm

```jsonc
{
  "plugin": [
    "opencode-agy-bridge@0.2.8"
  ],
  "provider": {
    "agy": {
      "npm": "opencode-agy-bridge",
      "name": "Google Antigravity (via agy CLI)",
      "options": { "binary": "agy", "timeoutMs": 300000 },
      "models": { "antigravity": { "name": "Antigravity (Gemini)" } }
    }
  }
}
```

> **Always pin a fixed version** in the `plugin` array (e.g. `@0.2.8`). Do **not** omit the version and do **not** use bare package names or `@latest` — new releases may contain bugs or breaking changes that would be pulled silently on the next OpenCode restart.

### Local development (absolute paths)

```jsonc
{
  "plugin": [
    "/home/USER/workspace/opencode-agy-bridge/dist/plugin.js"
  ],
  "provider": {
    "agy": {
      "npm": "/home/USER/workspace/opencode-agy-bridge",
      "name": "Google Antigravity (via agy CLI)",
      "options": { "binary": "agy", "timeoutMs": 300000 },
      "models": { "antigravity": { "name": "Antigravity (server-selected Gemini)" } }
    }
  }
}
```

Then restart OpenCode and run `/model` → select `agy/antigravity`.

## Features

- **Robust Delta Extraction:** Automatically normalizes `\r\n` (CRLF) and `\n` (LF) line endings, tolerates trailing whitespace/newline differences, and implements suffix-based alignment to support seamless recovery during context window truncation.

## Known limitations

| Limitation | Detail |
|---|---|
| **No real streaming** | `agy --print` buffers the full response and emits it on completion. Tokens appear in one batch, not one-by-one. PTY allocation (`script -q`) was tested and does not destrabilize the buffering — agy holds output until the response is complete regardless of whether stdout is a TTY. The provider therefore emits a single `text-delta` per turn instead of faking progressive chunks. |
| **Single cosmetic model** | `agy` does not accept `--model`. The model is chosen server-side by Antigravity. Declaring extra models in config has no effect. |
| **Requires authenticated `agy`** | You must run `agy` standalone at least once to authenticate via OAuth. |
| **No tool-call passthrough** | `agy` CLI does not return structured tool calls to the caller. Tool use happens inside agy's own process. |
| **Per-turn subprocess** | Each prompt spawns a fresh `agy` process. Context is preserved via `--conversation <id>`. |
| **Images/file parts omitted** | OpenCode messages with image/file content parts are skipped with a warning — `agy` CLI does not support them. |
| **Conversation binding heuristic** | The bridge infers `conversation_id` by diffing `~/.gemini/antigravity-cli/conversations/*.pb` before/after each turn. If multiple `.pb` files appear simultaneously, binding is refused and each turn runs in single-turn mode. |

## Installation issues in corporate environments

If you get `ProviderInitError` after configuring the bridge, it may be caused by an **OpenCode bug** where the provider package download fails silently (no error logged) instead of surfacing the underlying problem. This is commonly triggered by:

- **Corporate npm registry proxies** (Nexus, Artifactory, Verdaccio, JFrog — any `registry` configured in `~/.npmrc`) that enforce allowlists, security scans, or maturity policies on newly published packages.
- **Newly published versions** that haven't been cached or approved by the corporate proxy yet.

**Diagnostic:** check `~/.cache/opencode/packages/opencode-agy-bridge@<version>/`. If the directory is empty or missing files despite a successful OpenCode startup, the proxy silently blocked the download.

**Workaround:** temporarily comment out the `registry` line in `~/.npmrc`, restart OpenCode so it downloads the package from the public npm registry, then restore the corporate registry setting. The cached package in `~/.cache/opencode/packages/` will continue to work.

**Long-term fix:** ask your registry administrator to add `opencode-agy-bridge` to the package allowlist.

## Roadmap

### v0.x — Current

- **Unified plugin + provider entry point** — single npm package that OpenCode auto-detects as both plugin and provider.
- **Robust delta extraction** — end-of-line normalization (`\r\n` ↔ `\n`), whitespace-tolerant alignment, suffix fallback for context window truncation recovery.
- **Session persistence across restarts** — conversation state survives OpenCode restarts via `~/.opencode-agy-bridge/sessions.json`.
- **Conversation binding via `.pb` file diffing** — automatically discovers the `conversation_id` created by `agy` so multi-turn conversations work seamlessly.
- **Global binding lock** — prevents race conditions when multiple OpenCode instances run concurrently.

### Future — Real streaming (see [`specs/docs/STREAMING_RESEARCH.md`](specs/docs/STREAMING_RESEARCH.md))

The current bridge relies on `agy --print`, which buffers the full response before emitting it. Investigation has confirmed that the Antigravity **IDE binary** hosts a Connect/gRPC-JSON server (`language_server`) with streaming RPCs (`StreamCascadeReactiveUpdates`, `StreamCascadeSummariesReactiveUpdates`, `StreamAgentStateUpdates`) that deliver token-by-token output.

A future v2 could bypass `agy --print` entirely and speak directly to a language_server instance (either the one the IDE already runs, or one the plugin spawns itself), providing real progressive streaming instead of single-batch `text-delta` delivery. Estimated effort: ~2 weeks. Blocked pending proto reverse-engineering and ToS review.

## Project structure

```
src/
├── agy-runner.ts           # spawn agy, capture stdout/stderr
├── conversation-tracker.ts # snapshot .pb files, infer conversation_id
├── session-store.ts        # persist session→conversation_id mapping
├── prompt-mapper.ts        # Vercel AI SDK prompt → plain text
├── provider.ts             # LanguageModelV2 implementation (core)
└── plugin.ts               # OpenCode plugin entrypoint (hooks)
```

## Development

```bash
bun run build   # compile TypeScript
bun test        # run test suite
```


