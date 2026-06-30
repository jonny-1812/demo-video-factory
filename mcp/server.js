#!/usr/bin/env node
// demo-video-factory MCP server.
//
// Design: the video's quality comes from an LLM writing a per-product "brief".
// So this server does NOT try to be a one-shot black box. It exposes:
//   - scan_site(url)            -> capture brand/screenshots/copy, return a brief skeleton
//   - render_demo(slug, brief)  -> render the video from a brief the HOST LLM wrote
//   - prompt: demo_brief_guide  -> the brief schema + archetype guidance to follow first
// It pre-flights ffmpeg/Node and clones+installs the render engine on first use.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const REPO = "https://github.com/jonny-1812/demo-video-factory";
const ENGINE = process.env.DVF_HOME || path.join(homedir(), ".demo-video-factory-engine");

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ENGINE, encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"], ...opts });

function preflight() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); }
  catch { throw new Error("ffmpeg not found on PATH. Install it (macOS: `brew install ffmpeg`, Debian/Ubuntu: `sudo apt-get install ffmpeg`, Windows: `winget install Gyan.FFmpeg`) and retry."); }
  if (Number(process.versions.node.split(".")[0]) < 18) throw new Error(`Node ${process.versions.node} is too old; need Node 18+.`);
}

function ensureEngine() {
  if (existsSync(path.join(ENGINE, "package.json")) && existsSync(path.join(ENGINE, "agent"))) return;
  mkdirSync(path.dirname(ENGINE), { recursive: true });
  if (!existsSync(path.join(ENGINE, ".git"))) execFileSync("git", ["clone", "--depth", "1", REPO, ENGINE], { stdio: "ignore" });
  execSync("npm install", { cwd: ENGINE, stdio: "ignore" }); // also runs `playwright install chromium`
}

const slugFor = (url) => new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace(/^www\./, "").split(".")[0];

const server = new McpServer({ name: "demo-video-factory", version: "0.1.0" });

server.registerTool(
  "scan_site",
  {
    title: "Scan a SaaS site",
    description:
      "Step 1. Capture a SaaS site's brand (colors, fonts, logo), real screenshots and copy. Returns the scan manifest, scraped copy and the slug. After this, read the `demo_brief_guide` prompt, write a brief, then call render_demo. Requires ffmpeg + Chromium locally.",
    inputSchema: { url: z.string().describe("SaaS site URL, e.g. https://linear.app") },
  },
  async ({ url }) => {
    preflight();
    ensureEngine();
    const slug = slugFor(url);
    sh("npx", ["tsx", "agent/scan.ts", url], { timeout: 240000 });
    try { sh("npx", ["tsx", "agent/scrape.ts", url], { timeout: 120000 }); } catch { /* non-fatal */ }
    const manPath = path.join(ENGINE, "public", "real", slug, "manifest.json");
    const scrPath = path.join(ENGINE, "out", `${slug}_scraped.json`);
    const manifest = existsSync(manPath) ? JSON.parse(readFileSync(manPath, "utf8")) : null;
    const scraped = existsSync(scrPath) ? JSON.parse(readFileSync(scrPath, "utf8")) : null;
    const payload = { slug, manifest, scraped, next: "Read the demo_brief_guide prompt, write a brief for this product, then call render_demo(slug, brief)." };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }
);

server.registerTool(
  "render_demo",
  {
    title: "Render the demo video",
    description:
      "Step 2. Given the slug from scan_site and a brief object you wrote, render the ~26s demo video (writes the brief, builds music, assembles, renders with Remotion) and return the output mp4 path. The brief MUST match the schema in `demo_brief_guide`; a missing/misnested productUI.data hard-fails by design.",
    inputSchema: {
      slug: z.string(),
      brief: z.record(z.any()).describe("Full brief object: company, brand, pain, reveal, wow, outcome."),
      pace: z.enum(["fast", "normal", "relaxed"]).optional(),
      mood: z.string().optional().describe("auto | uplift | cinematic | lofi | electronic | corporate | anthem | none"),
    },
  },
  async ({ slug, brief, pace = "normal", mood = "auto" }) => {
    preflight();
    ensureEngine();
    mkdirSync(path.join(ENGINE, "out"), { recursive: true });
    writeFileSync(path.join(ENGINE, "out", `${slug}_brief.json`), JSON.stringify(brief, null, 2));
    if (mood !== "none") sh("npx", ["tsx", "agent/music.ts", slug, "37", mood], { timeout: 180000 });
    sh("npx", ["tsx", "agent/assemble-templated.ts", slug, pace], { timeout: 120000 }); // strict: validator catches bad briefs
    const out = `out/demo_${slug}.mp4`;
    sh("npx", ["remotion", "render", "DynamicDemo", out, "--concurrency=4"], { timeout: 900000 });
    return { content: [{ type: "text", text: `Rendered: ${path.join(ENGINE, out)}` }] };
  }
);

server.registerPrompt(
  "demo_brief_guide",
  { title: "How to write a demo brief", description: "The brief schema + archetype guidance to follow before calling render_demo." },
  async () => {
    ensureEngine();
    const guide = path.join(ENGINE, ".claude", "commands", "demo.md");
    const text = existsSync(guide) ? readFileSync(guide, "utf8") : `See ${REPO}`;
    return { messages: [{ role: "user", content: { type: "text", text } }] };
  }
);

await server.connect(new StdioServerTransport());
