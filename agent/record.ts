// Records the live product in motion (Playwright) → mp4, so the demo can SHOW
// the product working instead of a static screenshot. Slow-scrolls the page and
// clicks product nav tabs, records the whole thing, converts webm→mp4.
// Returns the mp4 path (relative to public/) or null (non-fatal: pipeline falls
// back to static screenshots).
import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'

export async function recordInteraction(url: string, slug: string, outDir: string): Promise<string | null> {
  let browser
  try {
    browser = await chromium.launch()
  } catch {
    console.error('record: chromium unavailable — run `npx playwright install chromium`')
    return null
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: outDir, size: { width: 1440, height: 900 } }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }))
    await page.waitForTimeout(2200)

    // dismiss a cookie/consent banner if present (it blocks the view)
    await page.evaluate(`(() => {
      const re = /accept|agree|got it|allow all/i
      for (const b of document.querySelectorAll('button,[role=button]')) {
        if (re.test(b.textContent || '')) { b.click(); break }
      }
    })()`).catch(() => {})
    await page.waitForTimeout(400)

    // slow cinematic scroll through the page (surfaces scroll-triggered product UI)
    for (const y of [0, 350, 750, 1150, 1600, 1100, 500]) {
      await page.evaluate(`window.scrollTo({ top: ${y}, behavior: 'smooth' })`)
      await page.waitForTimeout(750)
    }

    // click up to 4 in-product nav tabs to show the UI changing
    const targets = await page.evaluate(`(() => {
      const want = /^(inbox|my issues|issues|projects|reviews|dashboard|analytics|insights|timeline|board|calendar|overview|home|deployments|teams|cycles)$/i
      const out = []
      for (const el of document.querySelectorAll('button,[role=tab],a,[role=menuitem]')) {
        const t = (el.textContent || '').trim()
        if (!want.test(t)) continue
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8 || r.top < 0 || r.top > 880 || r.left < 0 || r.left > 1432) continue
        out.push({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), t })
        if (out.length >= 4) break
      }
      return out
    })()`) as { x: number; y: number; t: string }[]

    for (const tgt of targets) {
      await page.mouse.move(tgt.x, tgt.y, { steps: 12 })
      await page.waitForTimeout(250)
      await page.mouse.click(tgt.x, tgt.y).catch(() => {})
      await page.waitForTimeout(1100)
    }
    await page.waitForTimeout(1200)
  } catch (e) {
    console.error('record: interaction error', (e as Error).message.slice(0, 80))
  }

  const video = page.video()
  await context.close()  // flushes the webm
  await browser.close()
  if (!video) return null

  try {
    const webm = await video.path()
    const mp4 = path.join(outDir, 'interaction.mp4')
    execFileSync(FFMPEG, ['-y', '-i', webm, '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', mp4], { stdio: 'ignore' })
    try { unlinkSync(webm) } catch {}
    const rel = `real/${slug}/interaction.mp4`
    console.log('✓ recorded product interaction → public/' + rel)
    return rel
  } catch (e) {
    console.error('record: ffmpeg convert failed', (e as Error).message.slice(0, 80))
    return null
  }
}

// CLI for standalone testing
if (process.argv[1] && process.argv[1].includes('record')) {
  const raw = process.argv[2]
  if (!raw) { console.error('Usage: npx tsx agent/record.ts <url>'); process.exit(1) }
  const url = raw.startsWith('http') ? raw : 'https://' + raw
  const slug = new URL(url).hostname.replace(/^www\./, '').split('.')[0]
  const outDir = path.join(BASE, 'public', 'real', slug)
  execFileSync('mkdir', ['-p', outDir])
  recordInteraction(url, slug, outDir).then(r => console.log('result:', r))
}
