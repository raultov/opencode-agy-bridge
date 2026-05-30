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
    "opencode-agy-bridge@0.2.4"
  ],
  "provider": {
    "agy": {
      "npm": "opencode-agy-bridge",
      "name": "Google Antigravity (via agy CLI)",
      "options": { "binary": "agy", "timeoutMs": 300000 },
      "models": { "antigravity": { "name": "Antigravity (server-selected Gemini)" } }
    }
  }
}
```

### Using npm global install path

```jsonc
{
  "plugin": [
    "opencode-agy-bridge"
  ],
  "provider": {
    "agy": {
      "npm": "opencode-agy-bridge",
      "name": "Google Antigravity (via agy CLI)",
      "options": { "binary": "agy", "timeoutMs": 300000 },
      "models": { "antigravity": { "name": "Antigravity (server-selected Gemini)" } }
    }
  }
}
```

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

## CI/CD (GitHub Actions)

- **CI (`ci.yml`):** Runs on push and pull requests to `main` — compiles and runs all tests.
- **Release (`release.yml`):** Runs on `v*` tags — builds, tests, and publishes to npm.

### Setup

1. Generate a Granular Access Token on [npmjs.com](https://www.npmjs.com/) with **Bypass 2FA** enabled.
2. Add it as repository secret `NPM_TOKEN` in GitHub **Settings → Secrets and variables → Actions**.
