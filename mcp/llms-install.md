# Installing demo-video-factory-mcp

This MCP server renders demo videos **locally**. Before installing, ensure:

- **Node.js >= 18**
- **ffmpeg** on PATH (`ffmpeg -version` must print a version)
  - macOS: `brew install ffmpeg` · Debian/Ubuntu: `sudo apt-get install ffmpeg` · Windows: `winget install Gyan.FFmpeg`
- **Chromium** — installed automatically via Playwright on first use.

## Add to your MCP client config

```json
{
  "mcpServers": {
    "demo-video-factory": {
      "command": "npx",
      "args": ["-y", "demo-video-factory-mcp"]
    }
  }
}
```

On the first tool call the server clones the render engine to `~/.demo-video-factory-engine` and runs `npm install` (one-time; downloads Chromium). To skip that, set `DVF_HOME` to an existing clone of https://github.com/jonny-1812/demo-video-factory:

```json
"env": { "DVF_HOME": "/path/to/demo-video-factory" }
```

## Tools

- `scan_site(url)` — capture brand, screenshots, copy; returns a slug + manifest.
- `render_demo(slug, brief, pace?, mood?)` — render the video from a brief you wrote; returns the mp4 path.
- Prompt `demo_brief_guide` — the brief schema + archetype guidance. **Read it before calling `render_demo`.**

## Verify it works

Give the agent: `Scan https://linear.app, write a brief, and render a demo.` It should call `scan_site`, then `render_demo`, and return a path to `demo_linear.mp4`.
