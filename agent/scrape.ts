// Scrape-only CLI — no AI. Fetches the URL and writes out/<slug>_scraped.json.
// Used by the /demo Claude Code command so the in-session agent reads real data.
import { scrapeUrl } from './scraper.js'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')

async function main() {
  const raw = process.argv[2]
  if (!raw) {
    console.error('Usage: npx tsx agent/scrape.ts <url>')
    process.exit(1)
  }
  const url = raw.startsWith('http') ? raw : 'https://' + raw
  const domain = new URL(url).hostname.replace(/^www\./, '')
  const slug = domain.split('.')[0]

  const scraped = await scrapeUrl(url)
  mkdirSync(path.join(BASE, 'out'), { recursive: true })
  const outPath = path.join(BASE, 'out', slug + '_scraped.json')
  writeFileSync(outPath, JSON.stringify({ url, domain, slug, ...scraped }, null, 2))

  console.log('✓ Scraped: ' + (scraped.title || domain))
  console.log('  slug    : ' + slug)
  console.log('  saved   : out/' + slug + '_scraped.json')
  console.log('  colors  : themeColor=' + (scraped.themeColor || '(none)') + '  cssColors=' + (scraped.cssColors?.slice(0, 5).join(',') || '(none)'))
  console.log('  ogImage : ' + (scraped.ogImage || '(none)'))
}

main().catch(e => { console.error('scrape error:', (e as Error).message); process.exit(1) })
