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

  // 6. Find + download the brand LOGO (shown on Reveal/Outcome wordmark).
  //    Quality-ranked capture — a blurry favicon is WORSE than no logo (the
  //    renderer falls back to a clean text wordmark when logo is null), so we
  //    only ever accept a high-quality mark:
  //      a. header/nav inline <svg> logo  → serialize (resolution-independent)
  //      b. header/nav <img> logo         → download
  //      c. header brand background-image → download
  //      d. apple-touch-icon / largest web-manifest icon (≥64px, never .ico)
  //      e. else null  → text wordmark
  const logoPick = await page.evaluate(`(() => {
    const origin = location.origin
    const NEG = /(menu|hamburger|burger|toggle|nav-?icon|search|close|chevron|caret|arrow|expand|collapse|cart|account|avatar|user|profile|social|twitter|github|linkedin|discord|youtube|x-icon|theme|moon|sun|globe|sound|play|pause)/i
    const txt = (el) => (el && el.getAttribute ? ((el.getAttribute('class') || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('alt') || '')) : '').toString().toLowerCase()
    const ancTxt = (el) => { let s = '', p = el; for (let i = 0; i < 3 && p; i++) { s += ' ' + txt(p); p = p.parentElement } return s }
    const inHomeLink = (el) => { let p = el; for (let i = 0; i < 4 && p; i++) { if (p.tagName === 'A') { const h = (p.getAttribute('href') || ''); if (h === '/' || h === origin || h === origin + '/') return true } p = p.parentElement } return false }

    // ---- a) inline header/nav SVG logo (serialize w/ resolved colors) ----
    let svg = null
    {
      const cands = []
      document.querySelectorAll('header svg, nav svg, a[href="/"] svg, [class*="header" i] svg, [class*="navbar" i] svg, [id*="header" i] svg').forEach(sv => {
        const r = sv.getBoundingClientRect()
        if (r.width < 14 || r.height < 10 || r.width > 520 || r.height > 200 || r.top > 200) return
        const t = txt(sv) + ' ' + ancTxt(sv)
        if (NEG.test(t)) return
        // Reject status badges / cookie banners / any SVG carrying PROSE <text>
        // (e.g. cal.com's async "Degraded Performance" status pill). A real
        // wordmark is vector paths or at most a single brand token.
        let prose = false
        sv.querySelectorAll('text, tspan').forEach(te => {
          const w = (te.textContent || '').trim()
          if (!w) return
          if (w.split(/\\s+/).length > 1) prose = true
          if (/operational|degraded|performance|incident|status|outage|maintenance|loading|error|cookie|consent|uptime|beta|new/i.test(w)) prose = true
        })
        if (prose) return
        const home = inHomeLink(sv)
        const labelled = sv.getAttribute('role') === 'img' && !!sv.getAttribute('aria-label')
        const named = /logo|brand|wordmark/.test(t)
        if (!home && !labelled && !named) return     // require a real logo signal
        let n = 0
        if (home) n += 10
        if (named) n += 9
        if (labelled) n += 6
        if (r.left < 360) n += 4
        if (r.top < 110) n += 2
        cands.push({ sv, n, left: r.left, w: r.width, h: r.height })
      })
      cands.sort((a, b) => b.n - a.n || a.left - b.left)
      if (cands.length) {
        const c = cands[0]
        const orig = c.sv
        const clone = orig.cloneNode(true)
        // Resolve CSS variables / currentColor / class-based colors into explicit
        // fill+stroke attrs so the standalone SVG renders identically.
        const oAll = [orig].concat(Array.prototype.slice.call(orig.querySelectorAll('*')))
        const cAll = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*')))
        for (let i = 0; i < oAll.length && i < cAll.length; i++) {
          const cs = getComputedStyle(oAll[i]); const ce = cAll[i]
          if (!ce.setAttribute) continue
          const tag = (ce.tagName || '').toLowerCase()
          if (!/^(svg|g|path|circle|rect|ellipse|polygon|polyline|line|use)$/.test(tag)) continue
          if (cs.fill) ce.setAttribute('fill', cs.fill)
          if (cs.stroke && cs.stroke !== 'none') {
            ce.setAttribute('stroke', cs.stroke)
            if (cs.strokeWidth) ce.setAttribute('stroke-width', cs.strokeWidth)
            if (cs.strokeLinecap) ce.setAttribute('stroke-linecap', cs.strokeLinecap)
            if (cs.strokeLinejoin) ce.setAttribute('stroke-linejoin', cs.strokeLinejoin)
          }
        }
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        clone.removeAttribute('class')            // strip framework (tailwind) sizing
        let ar = 1
        const vb = clone.getAttribute('viewBox')
        if (vb) { const p = vb.trim().split(/[ ,]+/).map(Number); if (p.length === 4 && p[3] > 0) ar = p[2] / p[3] }
        else if (c.w && c.h) ar = c.w / c.h
        svg = { html: clone.outerHTML, aspect: ar }
      }
    }

    // ---- b) header/nav <img> logo ----
    let img = null
    {
      const score = (el) => {
        const s = txt(el)
        let n = 0; if (/logo|brand|wordmark/.test(s)) n += 10
        const r = el.getBoundingClientRect()
        if (r.top < 140 && r.left < 700) n += 5
        if (r.height >= 18 && r.height <= 90) n += 3
        if (inHomeLink(el)) n += 6
        return n
      }
      let best = null, bestN = -1, bestAR = 1
      for (const im of document.querySelectorAll('header img, nav img, a[href="/"] img, img')) {
        const src = im.currentSrc || im.src
        if (!src || src.startsWith('data:')) continue
        if (NEG.test(txt(im))) continue
        const r = im.getBoundingClientRect()
        if (r.width < 24 || r.height < 12 || r.height > 120) continue
        const n = score(im)
        if (n > bestN) { bestN = n; best = src; const w = im.naturalWidth || r.width, h = im.naturalHeight || r.height; bestAR = h > 0 ? w / h : 1 }
      }
      if (bestN >= 10) img = { url: best, aspect: bestAR }
    }

    // ---- c) header brand background-image ----
    let bg = null
    for (const el of document.querySelectorAll('header a[href="/"], header [class*="logo" i], [class*="logo" i] a, a[href="/"], header')) {
      const b = getComputedStyle(el).backgroundImage
      const m = b && b.match(/url\\(["']?([^"')]+)["']?\\)/)
      if (m && m[1] && !m[1].startsWith('data:')) {
        const r = el.getBoundingClientRect()
        if (r.top < 200 && r.width >= 24 && r.width <= 480 && r.height >= 12 && r.height <= 200) { bg = { url: m[1], aspect: r.height > 0 ? r.width / r.height : 1 }; break }
      }
    }

    // ---- d) icon links / web manifest (downloaded + gated node-side) ----
    const apple = (document.querySelector('link[rel="apple-touch-icon"]') || {}).getAttribute ? document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href') : null
    const manifest = (document.querySelector('link[rel="manifest"]') || {}).getAttribute ? document.querySelector('link[rel="manifest"]').getAttribute('href') : null
    const icons = []
    document.querySelectorAll('link[rel~="icon"]').forEach(l => { const h = l.getAttribute('href'); if (h) icons.push({ href: h, sizes: l.getAttribute('sizes') || '' }) })
    return { svg, img, bg, apple, manifest, icons }
  })()`) as {
    svg: { html: string; aspect: number } | null
    img: { url: string; aspect: number } | null
    bg: { url: string; aspect: number } | null
    apple: string | null
    manifest: string | null
    icons: { href: string; sizes: string }[]
  }

  // --- node-side download helpers + quality gate ---------------------------
  let logoFile: string | null = null
  let logoAspect = 1
  const fetchBuf = async (u: string) => {
    try {
      const abs = new URL(u, url).href
      const resp = await page.request.get(abs, { timeout: 12000 })
      if (!resp.ok()) return null
      return { abs, ct: resp.headers()['content-type'] || '', buf: await resp.body() }
    } catch { return null }
  }
  const isIco = (b: Buffer) => b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0
  const pngDims = (b: Buffer) =>
    (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
      ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null
  // Reject .ico (any extension), icon content-types, and rasters smaller than
  // ~64px on a side — a blur is worse than the clean text wordmark fallback.
  const rasterOk = (ct: string, buf: Buffer, declared?: number) => {
    if (buf.length < 300) return false
    if (isIco(buf)) return false
    if (/icon|vnd\.microsoft/.test(ct)) return false
    const d = pngDims(buf)
    if (d) return Math.max(d.w, d.h) >= 64
    if (declared !== undefined && declared > 0 && declared < 64) return false
    return true
  }
  const extFor = (ct: string) => ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('svg') ? 'svg' : ct.includes('gif') ? 'gif' : 'jpg'
  const sizeOf = (s: string) => { const m = (s || '').match(/(\d+)x(\d+)/i); return m ? Math.max(+m[1], +m[2]) : 0 }
  // A DOWNLOADED svg must be real vector art — not an empty <svg/> and not a
  // status pill / cookie banner (e.g. cal.com embeds a "Degraded Performance"
  // status SVG that is otherwise a perfect-looking logo candidate).
  const svgOk = (buf: Buffer) => {
    const s = buf.toString('utf8')
    if (!/<svg[\s>]/i.test(s)) return false
    if (!/<(path|circle|rect|polygon|polyline|ellipse|use)\b/i.test(s)) return false
    for (const t of s.match(/<text[\s\S]*?<\/text>|<tspan[\s\S]*?<\/tspan>/gi) || []) {
      const inner = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (!inner) continue
      if (inner.split(' ').length > 1) return false
      if (/operational|degraded|performance|incident|status|outage|maintenance|loading|error|cookie|consent|uptime/i.test(inner)) return false
    }
    return true
  }
  const writeSvg = (buf: Buffer) => { if (!svgOk(buf)) return false; writeFileSync(path.join(outDir, 'logo.svg'), buf); logoFile = `real/${slug}/logo.svg`; return true }
  const writeRaster = (ct: string, buf: Buffer, ar: number) => { const ext = extFor(ct); writeFileSync(path.join(outDir, `logo.${ext}`), buf); logoFile = `real/${slug}/logo.${ext}`; logoAspect = ar }

  // a) inline SVG — already color-resolved + vector-checked in the page; gate it
  if (logoPick.svg?.html && svgOk(Buffer.from(logoPick.svg.html, 'utf8'))) {
    writeFileSync(path.join(outDir, 'logo.svg'), logoPick.svg.html)
    logoFile = `real/${slug}/logo.svg`; logoAspect = logoPick.svg.aspect || 1
  }
  // b) <img> logo  c) background-image  (same handling)
  for (const cand of [logoPick.img, logoPick.bg]) {
    if (logoFile || !cand) continue
    const r = await fetchBuf(cand.url)
    if (!r || !r.ct.startsWith('image/')) continue
    if (r.ct.includes('svg')) { if (writeSvg(r.buf)) logoAspect = cand.aspect || 1 }
    else if (rasterOk(r.ct, r.buf)) writeRaster(r.ct, r.buf, cand.aspect || 1)
  }
  // d) apple-touch-icon (usually a high-res square PNG)
  if (!logoFile && logoPick.apple && !/\.ico(\?|$)/i.test(logoPick.apple)) {
    const r = await fetchBuf(logoPick.apple)
    if (r && r.ct.startsWith('image/')) {
      if (r.ct.includes('svg')) writeSvg(r.buf)
      else if (rasterOk(r.ct, r.buf, 180)) writeRaster(r.ct, r.buf, 1)
    }
  }
  // d2) largest icon declared in the web manifest (192/512 PNG)
  if (!logoFile && logoPick.manifest) {
    const mf = await fetchBuf(logoPick.manifest)
    if (mf) {
      try {
        const j = JSON.parse(mf.buf.toString('utf8')) as { icons?: { src: string; sizes?: string; type?: string }[] }
        const icons = (j.icons || []).filter(i => i.src && !/\.ico(\?|$)/i.test(i.src)).sort((a, b) => sizeOf(b.sizes || '') - sizeOf(a.sizes || ''))
        for (const ic of icons) {
          const r = await fetchBuf(new URL(ic.src, new URL(logoPick.manifest, url).href).href)
          if (!r || !r.ct.startsWith('image/')) continue
          if (r.ct.includes('svg')) { if (writeSvg(r.buf)) break }
          else if (rasterOk(r.ct, r.buf, sizeOf(ic.sizes || ''))) { writeRaster(r.ct, r.buf, 1); break }
        }
      } catch { /* not JSON */ }
    }
  }
  // e) generic <link rel=icon> — only if it passes the gate (≥64px, not .ico)
  if (!logoFile) {
    for (const ic of (logoPick.icons || []).filter(i => !/\.ico(\?|$)/i.test(i.href)).sort((a, b) => sizeOf(b.sizes) - sizeOf(a.sizes))) {
      const r = await fetchBuf(ic.href)
      if (!r || !r.ct.startsWith('image/')) continue
      if (r.ct.includes('svg')) { if (writeSvg(r.buf)) break }
      else if (rasterOk(r.ct, r.buf, sizeOf(ic.sizes))) { writeRaster(r.ct, r.buf, 1); break }
    }
  }
  // else: logoFile stays null → renderer shows the clean text wordmark.

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
