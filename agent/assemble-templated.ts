// Templated assembler — builds the video from prop-driven scene TEMPLATES
// (src/templates/scenes.tsx) fed by out/<slug>_brief.json. The LLM only writes
// the brief (data); the visual quality comes from the fixed templates.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')

const ORDER = ['Scene1_Pain', 'Scene2_Reveal', 'Scene3_Wow', 'Scene4_Outcome'] as const
const COMP = { Scene1_Pain: 'Pain', Scene2_Reveal: 'Reveal', Scene3_Wow: 'Wow', Scene4_Outcome: 'Outcome' }
// Tighter pacing — the old 150/300/450/210 (~36s) felt slow. Front-loaded scene
// animations just hold less; the product-UI scene is retimed to match.
const DUR: Record<string, number> = { Scene1_Pain: 120, Scene2_Reveal: 234, Scene3_Wow: 300, Scene4_Outcome: 168 }
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

export function assembleTemplated(slug: string): number {
  const briefPath = path.join(BASE, 'out', `${slug}_brief.json`)
  if (!existsSync(briefPath)) throw new Error(`brief not found: ${briefPath}`)
  const brief = JSON.parse(readFileSync(briefPath, 'utf-8'))

  // Hero-slot collision guard (code, not prompt): reveal/wow/outcome must use
  // DIFFERENT real images, or all 3 scenes look identical. Reassign from the
  // scan manifest's heroCandidates when they collide.
  try {
    const man = path.join(BASE, 'public', 'real', (brief.domain || '').replace(/^www\./, '').split('.')[0], 'manifest.json')
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

  console.log(`✓ Templated assemble: ${totalFrames} frames (${(totalFrames / 30).toFixed(1)}s), audio=${audio ?? 'none'}`)
  return totalFrames
}

if (process.argv[1] && process.argv[1].includes('assemble-templated')) {
  const slug = process.argv[2]
  if (!slug) { console.error('Usage: npx tsx agent/assemble-templated.ts <slug>'); process.exit(1) }
  assembleTemplated(slug)
}
