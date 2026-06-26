// Deep site scanner (Playwright). Captures the REAL rendered product:
//   - viewport + full-page screenshots
//   - section screenshots while scrolling
//   - downloads every substantial <img> and CSS background image (real product shots)
//   - extracts real computed brand colors + fonts
// Saves to public/real/<slug>/ and writes public/real/<slug>/manifest.json.
import { chromium } from 'playwright'
import { recordInteraction } from './record.js'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')

async function main() {
  const raw = process.argv[2]
  if (!raw) { console.error('Usage: npx tsx agent/scan.ts <url>'); process.exit(1) }
  const url = raw.startsWith('http') ? raw : 'https://' + raw
  const domain = new URL(url).hostname.replace(/^www\./, '')
  const slug = domain.split('.')[0]
  const outDir = path.join(BASE, 'public', 'real', slug)
  mkdirSync(outDir, { recursive: true })

  let browser
  try {
    browser = await chromium.launch()
  } catch (e) {
    // Browser not installed — degrade gracefully so the pipeline can fall back to scrape.ts
    console.error('SCAN_UNAVAILABLE: Chromium not installed. Run `npx playwright install chromium`, or the demo will use the basic scraper (og:image only) instead of real product photos.')
    console.error('detail: ' + (e as Error).message.slice(0, 120))
    process.exit(2)
  }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }))
  await page.waitForTimeout(2500)

  const shots: string[] = []
  // 1. Hero / viewport
  await page.screenshot({ path: path.join(outDir, 'hero.png') })
  shots.push('hero.png')
  // 2. Full page
  await page.screenshot({ path: path.join(outDir, 'fullpage.png'), fullPage: true }).catch(() => {})
  shots.push('fullpage.png')
  // 3. Section screenshots while scrolling
  const totalH = await page.evaluate('document.body.scrollHeight') as number
  let idx = 0
  for (let y = 0; y < Math.min(totalH, 1080 * 6); y += 900) {
    await page.evaluate(`window.scrollTo(0, ${y})`)
    await page.waitForTimeout(700)
    const f = `section_${idx}.png`
    await page.screenshot({ path: path.join(outDir, f) })
    shots.push(f)
    idx++
  }
  await page.evaluate('window.scrollTo(0, 0)')
  await page.waitForTimeout(500)

  // 4. Collect substantial images (rendered >= 200px on a side) + their natural size.
  // Passed as a string IIFE to avoid the tsx/esbuild __name helper leaking into the page.
  const imgs = await page.evaluate(`(() => {
    const out = []
    document.querySelectorAll('img').forEach(im => {
      const r = im.getBoundingClientRect()
      const w = im.naturalWidth || r.width
      const h = im.naturalHeight || r.height
      const src = im.currentSrc || im.src
      if (src && (r.width >= 200 || r.height >= 200) && w >= 200 && h >= 150) out.push({ src, w, h })
    })
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width < 400 || r.height < 250) return
      const bg = getComputedStyle(el).backgroundImage
      const m = bg && bg.match(/url\\(["']?([^"')]+)["']?\\)/)
      if (m && m[1] && !m[1].startsWith('data:')) out.push({ src: m[1], w: Math.round(r.width), h: Math.round(r.height) })
    })
    return out
  })()`) as { src: string; w: number; h: number }[]

  // Dedup + download
  const seen = new Set<string>()
  const downloaded: { file: string; src: string; w: number; h: number }[] = []
  let di = 0
  for (const im of imgs.sort((a, b) => b.w * b.h - a.w * a.h)) {
    let abs = im.src
    try { abs = new URL(im.src, url).href } catch { continue }
    if (seen.has(abs)) continue
    seen.add(abs)
    if (downloaded.length >= 12) break
    try {
      const resp = await page.request.get(abs, { timeout: 15000 })
      if (!resp.ok()) continue
      const ct = resp.headers()['content-type'] || ''
      if (!ct.startsWith('image/')) continue
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('svg') ? 'svg' : 'jpg'
      const buf = await resp.body()
      if (buf.length < 6000) continue // skip tiny icons
      const file = `img_${di}.${ext}`
      writeFileSync(path.join(outDir, file), buf)
      downloaded.push({ file, src: abs, w: im.w, h: im.h })
      di++
    } catch { /* skip */ }
  }

  // 5. Real computed brand colors + fonts (string IIFE — see note above).
  const brand = await page.evaluate(`(() => {
    const pick = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop) : ''
    const btn = document.querySelector('button, a[class*="btn"], a[class*="button"], [class*="cta"]')
    const h1 = document.querySelector('h1')
    const counts = {}
    document.querySelectorAll('button, a, h1, h2, [class*="btn"], [class*="cta"]').forEach(el => {
      const c = getComputedStyle(el).backgroundColor
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') counts[c] = (counts[c] || 0) + 1
    })
    const topBg = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0])
    return {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      h1Color: pick(h1, 'color'),
      h1Font: pick(h1, 'font-family'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      buttonBg: pick(btn, 'background-color'),
      buttonColor: pick(btn, 'color'),
      commonAccentBgs: topBg,
    }
  })()`) as Record<string, unknown>

  // 6. Find + download the brand LOGO (shown on Reveal/Outcome wordmark). Prefer a
  // real header logo <img>, then SVG logo, then apple-touch-icon, then favicon.
  const logoPick = await page.evaluate(`(() => {
    const score = (el) => {
      const s = ((el.getAttribute('alt') || '') + ' ' + (el.className || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase()
      let n = 0; if (/logo|brand|wordmark/.test(s)) n += 10
      const r = el.getBoundingClientRect()
      if (r.top < 140 && r.left < 700) n += 5            // top-left of page = likely header logo
      if (r.height >= 18 && r.height <= 90) n += 3        // logo-ish height
      return n
    }
    let best = null, bestN = -1, bestAR = 1
    for (const im of document.querySelectorAll('header img, nav img, a[href="/"] img, img')) {
      const src = im.currentSrc || im.src
      if (!src || src.startsWith('data:')) continue
      const r = im.getBoundingClientRect()
      if (r.width < 24 || r.height < 12 || r.height > 120) continue
      const n = score(im)
      if (n > bestN) { bestN = n; best = src; const w = im.naturalWidth || r.width, h = im.naturalHeight || r.height; bestAR = h > 0 ? w / h : 1 }
    }
    if (bestN >= 10) return { url: best, aspect: bestAR }
    const link = document.querySelector('link[rel="apple-touch-icon"]') || document.querySelector('link[rel~="icon"][sizes]') || document.querySelector('link[rel~="icon"]')
    if (link && link.getAttribute('href')) return { url: link.getAttribute('href'), aspect: 1 } // icons are square
    return best ? { url: best, aspect: bestAR } : null
  })()`) as { url: string; aspect: number } | null
  const logoUrl = logoPick?.url || null
  const logoAspect = logoPick?.aspect || 1

  let logoFile: string | null = null
  if (logoUrl) {
    try {
      const abs = new URL(logoUrl, url).href
      const resp = await page.request.get(abs, { timeout: 12000 })
      if (resp.ok()) {
        const ct = resp.headers()['content-type'] || ''
        if (ct.startsWith('image/')) {
          const ext = ct.includes('svg') ? 'svg' : ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('icon') || ct.includes('ico') ? 'png' : 'png'
          const buf = await resp.body()
          if (buf.length > 300) {
            writeFileSync(path.join(outDir, `logo.${ext}`), buf)
            logoFile = `real/${slug}/logo.${ext}`
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  await browser.close()

  // Record the product IN MOTION (separate browser w/ video recording) — the
  // footage that lets the demo actually SHOW the product working. Non-fatal.
  let interactionVideo: string | null = null
  let interactionVideoUsable = false
  if (downloaded.length > 0 || shots.length > 0) {
    const rec = await recordInteraction(url, slug, outDir).catch(() => null)
    interactionVideo = rec?.rel ?? null
    interactionVideoUsable = rec?.usable ?? false
  }

  // Detect a text-only / bot-blocked "machine version" (e.g. Ramp serves one to
  // headless browsers): no images downloaded AND default/unstyled fonts.
  const bf = String((brand as Record<string, unknown>).bodyFont || '')
  const textOnly = downloaded.length === 0 && (bf === '' || /^Times/i.test(bf) || /serif$/i.test(bf) && !/[A-Z][a-z]+ /.test(bf))
  // Hero candidates the brief-writer can choose from: real page screenshots first
  // (they capture the actual rendered product), then downloaded images.
  const heroCandidates = [...shots, ...downloaded.map(d => d.file)].map(f => `real/${slug}/${f}`)

  const manifest = { url, domain, slug, screenshots: shots, images: downloaded, brand, logo: logoFile, logoAspect, textOnly, heroCandidates, interactionVideo, interactionVideoUsable }
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log('✓ Scanned ' + url)
  console.log('  screenshots: ' + shots.join(', '))
  console.log('  product images downloaded: ' + downloaded.length)
  downloaded.forEach(d => console.log('    ' + d.file + '  ' + d.w + 'x' + d.h + '  <- ' + d.src.slice(0, 80)))
  if (textOnly) console.error('  ⚠ TEXT_ONLY: this site served a text/unstyled page to the headless browser (bot protection?). No real product visuals captured — the demo will be weak unless you supply screenshots in public/real/' + slug + '/.')
  console.log('  hero candidates: ' + heroCandidates.length + ' (screenshots preferred)')
  console.log('  saved to public/real/' + slug + '/  (+ manifest.json)')
}

main().catch(e => { console.error('scan error:', (e as Error).message); process.exit(1) })
