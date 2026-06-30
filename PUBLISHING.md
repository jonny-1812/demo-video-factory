# Publishing & Distribution Playbook

How `demo-video-factory` gets distributed, channel by channel. Verified against 2026 submission flows.

## The one structural fact

This product ships under **two identities**, and they gate different channels:

- **Skill / Claude Code plugin** — what it IS today. No code change. Unlocks the plugin marketplace + skills directories.
- **MCP server** — what the `mcp/` subpackage adds. Unlocks the MCP registries/directories.

The heavy caveat for the MCP lane: an MCP server **cannot install ffmpeg + Chromium**, and the product's quality comes from an LLM writing the per-video brief. So the MCP server is designed so the **host's LLM writes the brief** (it exposes a brief-writing prompt + a render tool), and it **pre-flight checks for ffmpeg/Chromium and fails fast**. The skill/plugin remains the primary, highest-quality distribution.

---

## Status

### ✅ Done (live)
| Channel | How | Link |
|---|---|---|
| skills.sh | `npx skills add jonny-1812/demo-video-factory` | live |
| Claude Code plugin (self-hosted marketplace) | `.claude-plugin/marketplace.json` + `plugin.json` in this repo | live |
| GitHub topics (feeds 3rd-party plugin crawlers) | `claude-code`, `claude-code-plugin`, `claude-plugin`, `claude-skill`, … | live |
| awesome-claude-skills (travisvn) | PR | https://github.com/travisvn/awesome-claude-skills/pull/929 |
| awesome-claude-code (hesreallyhim) | submission issue | https://github.com/hesreallyhim/awesome-claude-code/issues/2147 |

### ⏳ Needs Jonathan's login (one-time, interactive)
These cannot be done by an agent (npm / OAuth / web forms):

1. **npm publish** (unlocks npx + the MCP registry):
   ```bash
   cd mcp && npm login && npm publish --access public
   ```
2. **Official MCP Registry** (syndicates to VS Code + Cursor):
   ```bash
   cd mcp
   npx @modelcontextprotocol/publisher init    # or: mcp-publisher init
   mcp-publisher login github                   # device code at github.com/login/device
   mcp-publisher publish --dry-run && mcp-publisher publish
   ```
3. **Smithery** (MCPB local-stdio lane — the right fit for a local tool):
   ```bash
   npm i -g @smithery/cli
   smithery auth login
   smithery mcp publish ./mcp/server.mcpb -n jonny-1812/demo-video-factory
   ```
4. **Anthropic Community plugin directory** — submit the repo URL at
   https://claude.ai/admin-settings/directory/submissions/plugins/new (Team/Enterprise Owner)
   or the Console plugin submission page.

### ⏳ After npm publish — agent-doable MCP directory submissions (GitHub-auth)
Run these only once `demo-video-factory-mcp` is published to npm and smoke-tested, because reviewers install + test it:
- **Cline** — open an issue (NOT a PR) with a 400x400 PNG logo:
  https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml
- **mcp.so** — Submit button → issue, or POST https://mcp.so/api/submit-project
- **punkpeye/awesome-mcp-servers** — PR, alphabetical, tag `📇 🏠` (local stdio), title append `🤖🤖🤖` for fast-track
- **wong2/awesome-mcp-servers** — web form at https://mcpservers.org/submit
- **glama.ai/mcp**, **pulsemcp.com** — auto-ingest from the official registry once published; claim the listing with a web login. PulseMCP newsletter is the real launch lever.
- **Docker MCP Catalog** — fork docker/mcp-registry, `task wizard`, PR (human review). Note: confirm dependency licenses (Remotion has its own license).

---

## Repo files (all present)
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` — Claude Code plugin
- `skills/demo-video-factory/SKILL.md` — the skill (skills.sh + plugin)
- `commands/demo.md` — the `/demo` slash command (plugin)
- `mcp/` — the MCP server (server.json, smithery.yaml, package.json, llms-install.md)
- `LICENSE` — MIT

## Verified spec notes (so future edits don't break submissions)
- **Official registry `server.json`** — strictly requires only `name`, `description` (≤100 chars), `version`. `name` must be reverse-DNS with exactly one slash (e.g. `io.github.jonny-1812/demo-video-factory`). The npm package's `package.json` must contain a matching `"mcpName"`.
- **Smithery** discontinued hosted **stdio** on 2025-09-07; deployed servers must be Streamable HTTP. For a local tool, use the **MCPB bundle** lane (above), not a deploy.
- **Cline** submission is an **issue**, not a PR; `llms-install.md` is optional but recommended here (it scripts the ffmpeg/Chromium pre-checks).
