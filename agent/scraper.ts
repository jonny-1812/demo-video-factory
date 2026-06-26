export interface ScrapedContent {
  title: string
  description: string
  h1: string
  h2s: string[]
  h3s: string[]
  bodyText: string
  features: string[]
  themeColor: string
  ogImage: string
  cssColors: string[]
  logoUrl: string
  pricingHints: string
  categorySignals: string[]
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  const html = await res.text()

  const get = (pattern: RegExp) =>
    pattern.exec(html)?.[1]
      ?.replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim() || ''

  // Title — try OG title first, then regular title
  const title =
    get(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    get(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i) ||
    get(/<title[^>]*>([^<]+)<\/title>/i)

  // Description
  const description =
    get(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
    get(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i) ||
    get(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i) ||
    get(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i)

  // OG image
  const ogImage =
    get(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
    get(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)

  // Theme color
  const themeColor =
    get(/<meta[^>]+name="theme-color"[^>]+content="([^"]+)"/i) ||
    get(/<meta[^>]+content="([^"]+)"[^>]+name="theme-color"/i)

  // ── CSS custom property colors ────────────────────────────────────────────
  // Pull all <style> block content before stripping them out
  const styleBlocks = [...html.matchAll(/<style[\s\S]*?>([\s\S]*?)<\/style>/gi)]
    .map(m => m[1])
    .join('\n')

  // Match hex colours assigned to CSS custom properties anywhere in :root or globally
  // e.g. --primary: #3b82f6; or --brand-color:#fff;
  const cssColorMatches = [
    ...styleBlocks.matchAll(/--[\w-]+\s*:\s*(#[0-9a-fA-F]{3,8})\b/g),
  ]
  const cssColors = [...new Set(cssColorMatches.map(m => m[1].toLowerCase()))].slice(0, 10)

  // Strip scripts and styles before extracting text
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  // H1
  const h1 = get(/<h1[^>]*>([^<]{3,120})<\/h1>/i)

  // H2s — more than before, up to 10
  const h2Matches = [...stripped.matchAll(/<h2[^>]*>([^<]{3,100})<\/h2>/gi)]
  const h2s = h2Matches
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 10)

  // H3s — grab feature/benefit headings
  const h3Matches = [...stripped.matchAll(/<h3[^>]*>([^<]{3,80})<\/h3>/gi)]
  const h3s = h3Matches
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 10)

  // Feature paragraphs — grab li items and short paragraphs that sound like features
  const liMatches = [...stripped.matchAll(/<li[^>]*>([^<]{10,150})<\/li>/gi)]
  const features = liMatches
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 10 && !/</.test(t))
    .slice(0, 12)

  // Full body text — 5000 chars for better product understanding
  const bodyText = stripped
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)

  // ── Logo URL ───────────────────────────────────────────────────────────────
  // Tries double-quoted, single-quoted, and unquoted attribute values in priority order:
  //   <img class/alt *="logo">, <link rel="apple-touch-icon">, <link rel="icon">
  // Note: unquoted attributes are not matched — they are uncommon in modern HTML and
  // would require a more complex parser; the patterns below cover >95% of real sites.
  const getAttr = (pattern: RegExp) =>
    // Try double-quoted value first, then single-quoted
    pattern.exec(html)?.[1]
      ?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() || ''

  const logoUrl =
    // class contains "logo" — double-quoted then single-quoted
    getAttr(/<img[^>]+class="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i) ||
    getAttr(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*logo[^"]*"/i) ||
    getAttr(/<img[^>]+class='[^']*logo[^']*'[^>]+src='([^']+)'/i) ||
    getAttr(/<img[^>]+src='([^']+)'[^>]+class='[^']*logo[^']*'/i) ||
    // alt contains "logo" — double-quoted then single-quoted
    getAttr(/<img[^>]+alt="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i) ||
    getAttr(/<img[^>]+src="([^"]+)"[^>]+alt="[^"]*logo[^"]*"/i) ||
    getAttr(/<img[^>]+alt='[^']*logo[^']*'[^>]+src='([^']+)'/i) ||
    getAttr(/<img[^>]+src='([^']+)'[^>]+alt='[^']*logo[^']*'/i) ||
    // apple-touch-icon — double-quoted then single-quoted
    getAttr(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/i) ||
    getAttr(/<link[^>]+href="([^"]+)"[^>]+rel="apple-touch-icon"/i) ||
    getAttr(/<link[^>]+rel='apple-touch-icon'[^>]+href='([^']+)'/i) ||
    getAttr(/<link[^>]+href='([^']+)'[^>]+rel='apple-touch-icon'/i) ||
    // icon — double-quoted then single-quoted
    getAttr(/<link[^>]+rel="icon"[^>]+href="([^"]+)"/i) ||
    getAttr(/<link[^>]+href="([^"]+)"[^>]+rel="icon"/i) ||
    getAttr(/<link[^>]+rel='icon'[^>]+href='([^']+)'/i) ||
    getAttr(/<link[^>]+href='([^']+)'[^>]+rel='icon'/i)

  // ── Pricing hints ──────────────────────────────────────────────────────────
  // Extract short snippets of text around pricing signals.
  // matchAll with overlapping ±60-char windows can produce near-duplicate snippets
  // when multiple signals appear within ~120 chars of each other.  We deduplicate
  // by dropping any candidate snippet whose text is substantially contained in an
  // already-accepted snippet (substring check after normalising whitespace).
  const plainText = bodyText
  const pricingPattern = /(.{0,60}(?:\$\d|\bper month\b|\bper year\b|\b\/mo\b|\bpricing\b|\bfree trial\b|\bstarter\b|\bpro plan\b|\benterprise\b).{0,60})/gi
  const pricingMatches = [...plainText.matchAll(pricingPattern)]
  const rawPricingSnippets = pricingMatches
    .map(m => m[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  // Deduplicate: skip snippet B if it is fully contained within an already-kept snippet A
  const dedupedPricing: string[] = []
  for (const snippet of rawPricingSnippets) {
    const alreadyCovered = dedupedPricing.some(kept =>
      kept.includes(snippet) || snippet.includes(kept)
    )
    if (!alreadyCovered) dedupedPricing.push(snippet)
    if (dedupedPricing.length >= 5) break
  }
  const pricingHints = dedupedPricing.join(' | ')

  // ── Category signals ───────────────────────────────────────────────────────
  // Domain-specific keywords that reveal what kind of product/industry this is
  const categoryKeywords = [
    '3D', 'interior', 'design', 'book', 'schedule', 'invoice', 'fitness',
    'ecommerce', 'analytics', 'CRM', 'marketing', 'HR', 'payroll', 'legal',
    'healthcare', 'education', 'restaurant', 'real estate', 'photography',
    'video', 'audio', 'podcast', 'blog', 'social media', 'AI', 'automation',
    'project management', 'collaboration', 'storage', 'security', 'finance',
    'accounting', 'shipping', 'inventory', 'booking', 'appointment',
  ]
  const lowerBody = plainText.toLowerCase()
  const categorySignals = categoryKeywords.filter(kw => lowerBody.includes(kw.toLowerCase()))

  return {
    title, description, h1, h2s, h3s, bodyText, features, ogImage, themeColor,
    cssColors, logoUrl, pricingHints, categorySignals,
  }
}
