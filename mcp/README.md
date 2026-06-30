# demo-video-factory-mcp

MCP server that turns any SaaS URL into a ~26s branded product-demo video. It's a thin wrapper around the [demo-video-factory](https://github.com/jonny-1812/demo-video-factory) render engine (Remotion + Playwright).

## Why it's shaped this way

The video's quality comes from an LLM writing a per-product **brief** (brand, copy, which product-UI archetype to recreate). So this server is **not** a one-shot black box — it lets the **host's LLM** write the brief:

1. `scan_site(url)` → captures brand/screenshots/copy, returns a slug + manifest.
2. Read the `demo_brief_guide` prompt → write a brief for the product.
3. `render_demo(slug, brief)` → renders and returns the mp4 path.

## Requirements (local render)

- Node.js >= 18, **ffmpeg** on PATH, **Chromium** (auto-installed via Playwright on first use).

## Install

See [`llms-install.md`](./llms-install.md). Quick version:

```json
{ "mcpServers": { "demo-video-factory": { "command": "npx", "args": ["-y", "demo-video-factory-mcp"] } } }
```

## Caveat

An MCP server cannot guarantee ffmpeg/Chromium are present and a render is CPU-bound (~minutes), so this server **pre-flights** dependencies and fails fast with an install hint. For the highest-quality, lowest-friction experience, the [Claude Code skill/plugin](https://github.com/jonny-1812/demo-video-factory) is the primary distribution; this MCP server is for MCP-native hosts.

## Publishing

See [`../PUBLISHING.md`](../PUBLISHING.md).
