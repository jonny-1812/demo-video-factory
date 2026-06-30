# Demo Video Factory

Drop any SaaS URL → get a custom ~26s product demo video in minutes.

Built with **Claude Code + Remotion**. Each video is themed to *that* product — its real brand colors, fonts, logo, screenshots, copy, a recreated product‑UI scene, and a custom soundtrack.

```
/demo https://linear.app   →   out/demo_linear.mp4
```

## Example output

[![Watch the demo this tool generated](examples/corebee-demo-thumb.png)](examples/corebee-demo.mp4)

*Made with this tool — a demo for our own product, [Corebee](https://corebee.ai). ([watch the MP4](examples/corebee-demo.mp4))*

---

## Install

**As a Claude Code plugin** (recommended):

```
/plugin marketplace add jonny-1812/demo-video-factory
/plugin install demo-video-factory@demo-video-factory
```

Then run `/demo-video-factory:demo https://yourproduct.com` (plugin commands are namespaced; bare `/demo` also works if unambiguous).

**As a skill** (via [skills.sh](https://skills.sh)):

```
npx skills add jonny-1812/demo-video-factory
```

**Or clone it** (see [Setup](#setup)) and run `/demo` inside the repo.

> Runs in Claude Code and renders locally — you'll need **Node 18+, ffmpeg, and Chromium** (see [Requirements](#requirements)).

---

## How it works

The visual quality comes from fixed, hand‑built scene **templates** (`src/templates/scenes.tsx`). The AI's only job is to write a small **`brief.json`** (data: brand, copy, layout choices) — it never writes scene code. That's what keeps every video high‑quality *and* unique.

1. **Scan** (`agent/scan.ts`) — Playwright opens the site and captures real screenshots, computed brand colors + fonts, the logo, and a short screen recording.
2. **Scrape** (`agent/scrape.ts`) — pulls title, headings, and copy.
3. **Brief** — the Claude Code agent writes `out/<slug>_brief.json` (data only).
4. **Music** (`agent/music.ts`) — a procedural, per‑product soundtrack (needs `ffmpeg`).
5. **Assemble** (`agent/assemble-templated.ts`) — fills the templates from the brief → `src/generated/`.
6. **Render** — Remotion renders `out/demo_<slug>.mp4` (1920×1080, with audio).

### The 4 scenes
- **Pain** — the problem, tinted to the brand. Layouts: `cards` (notification chaos) · `tabs` (tool sprawl) · `stack` (cost ledger).
- **Reveal** — logo lockup + the real product screenshot in a clean browser frame. Layouts: `browser` · `split` · `fullbleed`.
- **Wow** — the product's actual UI, **recreated in code and themed to the brand**: `scheduling` · `pipeline` (ATS/CRM) · `formbuilder` · `designstudio`. Falls back to a screenshot‑based scene (`checklist` · `beforeafter` · `gallery`) when no recreation fits.
- **Outcome** — the headline result + CTA. Layouts: `stat` · `metrics`.

---

## Requirements

- **Node.js 18+**
- **ffmpeg** — for the soundtrack (must be on your `PATH`):
  - macOS: `brew install ffmpeg`
  - Debian/Ubuntu: `sudo apt-get install ffmpeg`
  - Windows: `winget install Gyan.FFmpeg` (or download from [ffmpeg.org](https://ffmpeg.org/download.html))
- **Claude Code** (for the recommended `/demo` flow):
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude login
  ```

## Setup

```bash
git clone https://github.com/jonny-1812/demo-video-factory
cd demo-video-factory
npm install          # also runs `playwright install chromium`
```

`npm install` downloads a Chromium build for the scanner. The repo ships with a
placeholder composition so it compiles immediately — `remotion studio` works
before you ever run `/demo`.

---

## Usage

Open the repo in **Claude Code** and run:

```
/demo https://yourproduct.com
```

That's it. The agent you're already talking to does the AI work itself (writes the
brief, picks the layouts) — **no API key, no subprocess, no login juggling**. It
shells out only to scan, scrape, build music, and render. Output: **`out/demo_<slug>.mp4`**.

Prefer to drive it by hand? The individual steps are also npm scripts:

```bash
npm run scan https://yourproduct.com     # screenshots + brand + logo
npm run scrape https://yourproduct.com   # copy
# write out/<slug>_brief.json  (see samples/placeholder_brief.json for the shape)
npm run music <slug>                     # soundtrack
npm run assemble <slug>                  # fill the templates
npm run render                           # → out/demo.mp4
```

---

## Output

- 1920×1080 MP4, ~26 seconds, with a custom soundtrack.
- Generation takes ~4–6 minutes (most of it is the Remotion render).
- Scanned assets land in `public/real/<slug>/` and the brief in `out/<slug>_brief.json` (both gitignored / per‑run).

## Notes

- `src/generated/` is committed with a placeholder default so a fresh clone compiles. `/demo` overwrites it each run — that's expected; you don't need to commit those local changes.
- The example in `examples/corebee-demo.mp4` was made with this exact tool — it's a real demo for [Corebee](https://corebee.ai), the product we build. Run `/demo https://yourproduct.com` to make your own.
- If a site serves a text‑only page to headless browsers (bot protection), the scan flags `textOnly` and you can drop your own screenshots into `public/real/<slug>/`.
- Add a new recreated product‑UI type by adding a component to `src/templates/scenes.tsx` and registering it in the `PRODUCT_UI` map.

## Project structure

```
agent/
  scan.ts                — Playwright: screenshots, brand, fonts, logo, screen recording
  scrape.ts              — text content
  music.ts               — procedural per‑product soundtrack (ffmpeg)
  assemble-templated.ts  — fills the templates from out/<slug>_brief.json
  record.ts              — records the live product in motion
src/
  templates/scenes.tsx   — the scene templates (Pain / Reveal / Wow / Outcome + variants)
  generated/             — composition built from the brief (placeholder committed)
  Root.tsx               — Remotion root (DynamicDemo composition)
commands/demo.md         — the /demo slash command (plugin)
out/                     — rendered videos (gitignored)
public/real/<slug>/      — scanned assets (gitignored)
```

---

## Built by Corebee

This tool is free and MIT-licensed, built by the team behind [Corebee](https://corebee.ai) (AI customer support for SaaS). The example demo above was made with it, for Corebee.

## Licenses

This project's own code is MIT (see [`LICENSE`](./LICENSE)). It renders with **[Remotion](https://remotion.dev)**, which is **not** MIT/OSS: Remotion is free for individuals and for-profit orgs of up to 3 people, but commercial use by orgs of 4+ people — or any automated/programmatic rendering — requires a paid Remotion license (Company License, or the Automators plan). See [remotion.pro/license](https://remotion.pro/license). The MIT license here covers only this project's own code, not its dependencies.
