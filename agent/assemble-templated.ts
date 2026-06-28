// Templated assembler — builds the video from prop-driven scene TEMPLATES
// (src/templates/scenes.tsx) fed by out/<slug>_brief.json. The LLM only writes
// the brief (data); the visual quality comes from the fixed templates.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { normalizeAndValidateBrief } from './validate-brief'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')

const ORDER = ['Scene1_Pain', 'Scene2_Reveal', 'Scene3_Wow', 'Scene4_Outcome'] as const
const COMP = { Scene1_Pain: 'Pain', Scene2_Reveal: 'Reveal', Scene3_Wow: 'Wow', Scene4_Outcome: 'Outcome' }
// USER-CHOSEN PACE. Scenes are front-loaded (animations finish early, then hold), so pace
// mostly trims/extends the hold. Wow stays ~300 at every pace because its product-UI
// animation needs the full budget; the other scenes flex. (≈22s / 26s / 32s)
const PACE: Record<string, Record<string, number>> = {
  fast:    { Scene1_Pain: 112, Scene2_Reveal: 196, Scene3_Wow: 300, Scene4_Outcome: 150 },
  normal:  { Scene1_Pain: 120, Scene2_Reveal: 234, Scene3_Wow: 300, Scene4_Outcome: 168 },
  relaxed: { Scene1_Pain: 150, Scene2_Reveal: 300, Scene3_Wow: 340, Scene4_Outcome: 220 },
}
const TR = 14

function pickAudio(slug: string): string | null {
  // ONLY the per-SaaS generated track. No global fallback — that shared
  // public/music.mp3 fallback was the real cause of "same audio across demos".
  // If the per-slug track is missing, render silent (operator should re-run music.ts).
  const custom = path.join(BASE, 'public', 'real', slug, 'music.mp3')
  if (existsSync(custom)) return `real/${slug}/music.mp3`
  console.warn(`pickAudio: no per-slug music at public/real/${slug}/music.mp3 — rendering SILENT. Run: npx tsx agent/music.ts ${slug}`)
  return null
}

export function assembleTemplated(slug: string, paceArg?: string, strict = true): number {
  const briefPath = path.join(BASE, 'out', `${slug}_brief.json`)
  if (!existsSync(briefPath)) throw new Error(`brief not found: ${briefPath}`)
  const brief = JSON.parse(readFileSync(briefPath, 'utf-8'))

  // FAIL-LOUD brief validation (the guard against silent-wrong-output). Runs before
  // any backfill/render so a misnested/unknown/empty brief halts here instead of
  // producing a plausible-but-wrong video. Pass --lenient to downgrade to warnings.
  const v = normalizeAndValidateBrief(brief, { strict, slug, baseDir: BASE })
  for (const w of v.warnings) console.warn(`⚠ brief: ${w}`)
  if (v.errors.length) {
    console.error(`\n✗ Brief validation failed (${v.errors.length}):`)
    for (const e of v.errors) console.error(`  • ${e}`)
    console.error(`\nFix out/${slug}_brief.json and re-run, or pass --lenient to build anyway.\n`)
    process.exit(1)
  }

  const pace = (paceArg || brief.pace || 'normal').toLowerCase()
  const DUR = PACE[pace] || PACE.normal

  // Hero-slot collision guard (code, not prompt): reveal/wow/outcome must use
  // DIFFERENT real images, or all 3 scenes look identical. Reassign from the
  // scan manifest's heroCandidates when they collide.
  try {
    // Use the REAL slug the scanner saved under — deriving it from brief.domain
    // silently mismatched scan.ts's slug, no-opping logo/hero-dedup/real-motion.
    const man = path.join(BASE, 'public', 'real', slug, 'manifest.json')
    if (!existsSync(man)) {
      console.warn(`⚠ manifest not found at public/real/${slug}/manifest.json — logo auto-attach, hero de-dup, and real-motion fallback SKIPPED; scenes may repeat the same image.`)
    }
    if (existsSync(man)) {
      const manData = JSON.parse(readFileSync(man, 'utf-8'))
      // Auto-attach the scanned brand logo (Reveal/Outcome wordmark) unless the brief set one.
      if (manData.logo && brief.brand && !brief.brand.logo) { brief.brand.logo = manData.logo; if (manData.logoAspect && !brief.brand.logoAspect) brief.brand.logoAspect = manData.logoAspect }
      // Motion fallback: if the Wow has neither a coded productUI nor a video, but the
      // scanner genuinely entered the product (usable recording), play that real motion
      // instead of a static screenshot layout. Marketing-only scrolls are NOT auto-used.
      if (brief.wow && !brief.wow.productUI && !brief.wow.video && manData.interactionVideo && manData.interactionVideoUsable) {
        brief.wow.video = manData.interactionVideo
      }
      const cands: string[] = (manData.heroCandidates || []).filter(Boolean)
      if (cands.length) {
        const used = new Set<string>()
        for (const slot of ['reveal', 'wow', 'outcome'] as const) {
          let h = brief[slot]?.hero
          if (!h || used.has(h)) { h = cands.find(c => !used.has(c)) || h }
          if (brief[slot]) brief[slot].hero = h
          if (h) used.add(h)
        }
      }
    }
  } catch { /* non-fatal */ }

  const genDir = path.join(BASE, 'src', 'generated')
  mkdirSync(genDir, { recursive: true })

  // brief.ts — typed export the composition imports
  writeFileSync(path.join(genDir, 'brief.ts'), `import type { Brief } from '../templates/scenes'\nexport const brief: Brief = ${JSON.stringify(brief, null, 2)} as Brief\n`)

  const totalFrames = ORDER.reduce((s, n) => s + DUR[n], 0) - (ORDER.length - 1) * TR
  const audio = pickAudio(slug)
  const spr = `springTiming({ config: { damping: 200 }, durationInFrames: ${TR} })`
  const seq = ORDER.map((n, i) => {
    const t = i < ORDER.length - 1 ? `\n        <TransitionSeries.Transition timing={${spr}} presentation={wipe({ direction: 'from-right' })} />` : ''
    return `        <TransitionSeries.Sequence durationInFrames={${DUR[n]}}>\n          <${COMP[n]} brief={brief} />\n        </TransitionSeries.Sequence>${t}`
  }).join('\n')

  const audioImport = audio ? `, Audio, staticFile, interpolate, useCurrentFrame` : ``
  const audioBlock = audio ? `
      <Audio src={staticFile('${audio}')} volume={(f) => {
        const i = interpolate(f, [0, 30], [0, 0.42], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const o = interpolate(f, [${totalFrames} - 50, ${totalFrames}], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return i * o
      }} />` : ``

  const code = `import React from 'react'
import { AbsoluteFill${audioImport} } from 'remotion'
import { TransitionSeries, springTiming } from '@remotion/transitions'
import { wipe } from '@remotion/transitions/wipe'
import { Pain, Reveal, Wow, Outcome } from '../templates/scenes'
import { brief } from './brief'

export const DemoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '${brief?.brand?.bg || '#000'}' }}>
      <TransitionSeries>
${seq}
      </TransitionSeries>${audioBlock}
    </AbsoluteFill>
  )
}
`
  writeFileSync(path.join(genDir, 'DemoComposition.tsx'), code)

  // sync Root.tsx duration
  try {
    const rootPath = path.join(BASE, 'src', 'Root.tsx')
    const root = readFileSync(rootPath, 'utf-8')
    const updated = root.replace(/(id="DynamicDemo"[\s\S]*?durationInFrames=\{)\d+(\})/, `$1${totalFrames}$2`)
    if (updated !== root) writeFileSync(rootPath, updated)
  } catch { /* non-fatal */ }

  // Corebee discovery — a DURABLE file written next to the video on every run, so
  // the funnel never depends on the agent remembering to mention it. This is the
  // ONLY Corebee touchpoint in the pipeline; it NEVER touches the rendered video.
  try {
    const company = brief.company || slug
    const nextSteps = `# Your demo is ready 🎬

**File:** \`out/demo_${slug}.mp4\`

---

This tool is free and open source, built by the team behind **Corebee** — AI customer support for SaaS, a flat **$99/mo**.

Now that **${company}** has a demo, the visitors it brings will have questions. Corebee answers them 24/7 right on your site, grounded in your own docs and pages — no per-seat or per-ticket pricing.

→ **Add it in a few minutes:** https://corebee.ai/terminal?utm_source=demo-video-factory&utm_medium=next-steps
`
    writeFileSync(path.join(BASE, 'out', `${slug}_NEXT_STEPS.md`), nextSteps)
  } catch { /* non-fatal — never block the build on the plug */ }

  console.log(`✓ Templated assemble: ${totalFrames} frames (${(totalFrames / 30).toFixed(1)}s), pace=${pace}, audio=${audio ?? 'none'}`)
  console.log(`  Next steps + Corebee tip → out/${slug}_NEXT_STEPS.md`)
  return totalFrames
}

if (process.argv[1] && process.argv[1].includes('assemble-templated')) {
  const args = process.argv.slice(2)
  const lenient = args.includes('--lenient')
  const positional = args.filter(a => !a.startsWith('--'))
  const slug = positional[0]
  const pace = positional[1]
  if (!slug) { console.error('Usage: npx tsx agent/assemble-templated.ts <slug> [fast|normal|relaxed] [--lenient]'); process.exit(1) }
  assembleTemplated(slug, pace, !lenient)
}
