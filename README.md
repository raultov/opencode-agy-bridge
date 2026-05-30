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

### 1. Automatic Installation (Recommended)

If you are using OpenCode's built-in plugin manager, **you do not need to run any commands** in your terminal. OpenCode can automatically fetch and install the package from npm if you specify the package name with its version in your `opencode.json` configuration file.

See the [Configuration](#configuration) section below for details.

### 2. Manual Global Installation

If you prefer to install it globally yourself using a package manager:

```bash
# Using npm
npm install -g opencode-agy-bridge

# Using Bun
bun install -g opencode-agy-bridge

# Using pnpm
pnpm add -g opencode-agy-bridge
```

### 3. Local Development Installation

If you prefer to build from source:

```bash
git clone https://github.com/raultov/opencode-agy-bridge.git
cd opencode-agy-bridge

# Using Bun (recommended)
bun install
bun run build
bun test       # verify all tests pass

# Or using pnpm/npm
pnpm install && pnpm run build && pnpm test
```

## Features

- **Robust Delta Extraction:** Automatically normalizes `\r\n` (CRLF) and `\n` (LF) line endings, tolerates trailing whitespace/newline differences, and implements suffix-based alignment to support seamless recovery during context window truncation.

## Configuration

Add the plugin and provider to your `~/.config/opencode/opencode.json` configuration file:

### For Automatic Installation (Hands-free)

Just add the package directly with the desired version tag. OpenCode will download and resolve it automatically from npm:

```jsonc
{
  "plugin": [
    // ...your existing plugins...
    "opencode-agy-bridge@0.2.0"
  ],
  "provider": {
    // ...your existing providers...
    "agy": {
      "npm": "opencode-agy-bridge@0.2.0/provider",
      "name": "Google Antigravity (via agy CLI)",
      "options": {
        "binary": "agy",
        "timeoutMs": 300000
      },
      "models": {
        "antigravity": {
          "name": "Antigravity (server-selected Gemini)"
        }
      }
    }
  }
}
```

### For Manual Global Installation

```jsonc
{
  "plugin": [
    // ...your existing plugins...
    "opencode-agy-bridge"
  ],
  "provider": {
    // ...your existing providers...
    "agy": {
      "npm": "opencode-agy-bridge/provider",
      "name": "Google Antigravity (via agy CLI)",
      "options": {
        "binary": "agy",
        "timeoutMs": 300000
      },
      "models": {
        "antigravity": {
          "name": "Antigravity (server-selected Gemini)"
        }
      }
    }
  }
}
```

> [!NOTE]
> If OpenCode has trouble resolving the global module name directly, you can replace the module names with their absolute paths pointing to your global `node_modules` folder (e.g., `"/usr/local/lib/node_modules/opencode-agy-bridge/dist/plugin.js"` for the plugin and `"/usr/local/lib/node_modules/opencode-agy-bridge/dist/provider.js"` for the provider).

### For Local Development / Manual Installation

```jsonc
{
  "plugin": [
    // ...your existing plugins...
    "/home/USER/workspace/opencode-agy-bridge/dist/plugin.js"
  ],
  "provider": {
    // ...your existing providers...
    "agy": {
      "npm": "/home/USER/workspace/opencode-agy-bridge",
      "name": "Google Antigravity (via agy CLI)",
      "options": {
        "binary": "agy",
        "timeoutMs": 300000
      },
      "models": {
        "antigravity": {
          "name": "Antigravity (server-selected Gemini)"
        }
      }
    }
  }
}
```

Then restart OpenCode and run `/model` → select `agy/antigravity`.

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

Using **Bun**:
```bash
bun run build
bun test
```

Using **pnpm**:
```bash
pnpm run build
pnpm test
```

Using **npm**:
```bash
npm run build
npm test
```

## CI/CD (GitHub Actions)

The project includes two GitHub Actions workflows:

- **CI (`ci.yml`):** Runs on push and pull requests to `main` or `master` to compile the project and execute all unit tests using Bun.
- **Release (`release.yml`):** Runs automatically when a new version tag matching `v*` (e.g., `v0.2.0`) is pushed to the repository. It automatically installs dependencies, builds, tests, and publishes the package to the public npm registry.

Note that both `npm` and `pnpm` share the same public registry (`registry.npmjs.org`), so a single publish step makes the package installable by both package managers.

### Setup

To enable automated releases:
1. Generate an Access Token with publish permissions on [npmjs.com](https://www.npmjs.com/).
2. Add the token as a repository secret named `NPM_TOKEN` in your GitHub repository settings under **Settings** → **Secrets and variables** → **Actions**.
