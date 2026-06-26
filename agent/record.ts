// Records the live product in motion (Playwright) → mp4, so the demo can SHOW
// the product working instead of a static screenshot. Slow-scrolls the page and
// clicks product nav tabs, records the whole thing, converts webm→mp4.
// Returns the mp4 path (relative to public/) or null (non-fatal: pipeline falls
// back to static screenshots).
import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import { existsSync, unlinkSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'

export async function recordInteraction(url: string, slug: string, outDir: string): Promise<{ rel: string; usable: boolean } | null> {
  let browser
  try {
    browser = await chromium.launch()
  } catch {
    console.error('record: chromium unavailable — run `npx playwright install chromium`')
    return null
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: outDir, size: { width: 1440, height: 900 } }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  let usable = false
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

    // click in-product nav tabs AND product-action affordances to show the UI working
    const targets = await page.evaluate(`(() => {
      const navRe = /^(inbox|my issues|issues|projects|reviews|dashboard|analytics|insights|timeline|board|calendar|overview|home|deployments|teams|cycles)$/i
      const actRe = /(try it|try now|generate|upload|create|run|new |compose|build|playground|open app|launch app|live demo)/i
      const out = []
      for (const el of document.querySelectorAll('button,[role=tab],a,[role=menuitem],[role=button]')) {
        const t = (el.textContent || '').trim().toLowerCase()
        if (!t || t.length > 28) continue
        const kind = navRe.test(t) ? 'nav' : (actRe.test(t) ? 'act' : null)
        if (!kind) continue
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8 || r.top < 0 || r.top > 880 || r.left < 0 || r.left > 1432) continue
        out.push({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), kind })
        if (out.length >= 6) break
      }
      return out
    })()`) as { x: number; y: number; kind: string }[]

    const before = await page.evaluate('location.pathname') as string
    for (const tgt of targets) {
      await page.mouse.move(tgt.x, tgt.y, { steps: 12 })
      await page.waitForTimeout(250)
      await page.mouse.click(tgt.x, tgt.y).catch(() => {})
      await page.waitForTimeout(1100)
    }
    await page.waitForTimeout(1200)
    // "usable" = we genuinely navigated into the product (not still on the marketing/auth page).
    const after = await page.evaluate('location.pathname') as string
    usable = after !== before && !/sign|login|register|auth|pricing|contact|checkout|cart/i.test(after)
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
    console.log('✓ recorded product interaction → public/' + rel + (usable ? ' (entered product)' : ' (marketing only)'))
    return { rel, usable }
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
  mkdirSync(outDir, { recursive: true })
  recordInteraction(url, slug, outDir).then(r => console.log('result:', r))
}
