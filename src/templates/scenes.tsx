// Prop-driven scene TEMPLATES — the proven hand-crafted layouts (Dexo/Linear
// quality) generalized to a Brief. The pipeline fills these with real
// screenshots + brand + copy; it never writes scene code from scratch.
// This is what makes ANY well-scanned SaaS render at a high, consistent bar.
import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile, OffthreadVideo } from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadDM } from '@remotion/google-fonts/DMSans'
import { loadFont as loadHeebo } from '@remotion/google-fonts/Heebo'

const FONTS: Record<string, string> = {
  inter: loadInter().fontFamily,
  playfair: loadPlayfair().fontFamily,
  grotesk: loadGrotesk().fontFamily,
  dmsans: loadDM().fontFamily,
  heebo: loadHeebo().fontFamily, // Hebrew + Latin — use for Hebrew/RTL products
}
const font = (k?: string) => FONTS[k || 'inter'] || FONTS.inter

// Brand wordmark: shows the product's REAL logo when scanned (brand.logo), else
// a styled text wordmark. Keeps the per-scene reveal animation (op + translateY).
const Brandmark: React.FC<{ brief: Brief; color: string; size: number; op: number; ty?: number; shadow?: boolean; mb?: number }> = ({ brief, color, size, op, ty = 0, shadow, mb }) => {
  const logo = brief.brand.logo
  const aspect = brief.brand.logoAspect || 1
  const sh = shadow ? '0 12px 40px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.12)'
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', opacity: op, transform: `translateY(${ty}px)`, marginBottom: mb }
  // WIDE WORDMARK (aspect ≥ 2.2): clean white badge that HUGS the wordmark.
  if (logo && aspect >= 2.2) {
    const pad = Math.round(size * 0.34)
    return (
      <div style={{ ...base, background: '#ffffff', borderRadius: Math.round(size * 0.3), padding: `${pad}px ${Math.round(pad * 1.4)}px`, boxShadow: sh }}>
        <Img src={staticFile(logo)} style={{ height: size, width: 'auto', maxWidth: 520, objectFit: 'contain', display: 'block' }} />
      </div>
    )
  }
  // SQUARE-ISH ICON: app-style lockup — small rounded chip + the company name.
  if (logo) {
    const ic = Math.round(size * 1.16)
    return (
      <div style={base}>
        <div style={{ width: ic, height: ic, borderRadius: Math.round(ic * 0.24), background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: sh, marginRight: Math.round(size * 0.34), flexShrink: 0 }}>
          <Img src={staticFile(logo)} style={{ width: Math.round(ic * 0.72), height: Math.round(ic * 0.72), objectFit: 'contain' }} />
        </div>
        <span style={{ color, fontSize: size, fontWeight: 800, letterSpacing: -size * 0.025, fontFamily: font(brief.fonts.heading), textShadow: shadow ? '0 2px 16px rgba(0,0,0,0.6)' : undefined }}>{brief.company}</span>
      </div>
    )
  }
  // no logo → styled text wordmark
  return <div style={{ ...base, color, fontSize: size, fontWeight: 800, letterSpacing: -size * 0.025, fontFamily: font(brief.fonts.heading), textShadow: shadow ? '0 2px 16px rgba(0,0,0,0.6)' : undefined }}>{brief.company}</div>
}

// Hero-backed scenes (Wow/Outcome) always use a dark cinematic stage so the real
// screenshot stays vivid and text is high-contrast — works for light AND dark brands.
const STAGE = '8,10,14'
const LIGHT = '#f4f6f9'
const LMUTED = '#aab0ba'

// Brand-contrast helpers: a brand color (e.g. Vercel's black primary) can be
// invisible on the dark stage. Pick a readable accent + CTA for any brand.
const lum = (hex: string) => { const h = (hex || '').replace('#', ''); if (h.length < 6) return 1; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 }
// accent readable on a dark stage: use primary if mid-bright, else accent, else white
const accentOnDark = (b: Brief['brand']) => { if (lum(b.primary) >= 0.32 && lum(b.primary) <= 0.92) return b.primary; if (lum(b.accent) >= 0.32 && lum(b.accent) <= 0.92) return b.accent; return '#ffffff' }
const ctaText = (bg: string) => (lum(bg) > 0.6 ? '#0b0d11' : '#ffffff')

// A recreated, brand-themed product UI for the Wow scene — looks like THE product
// (its real screens, design language, colors) and animates its core workflow.
export interface ProductUI {
  // Only kinds with a real recreation in PRODUCT_UI — keep this in sync with that map.
  kind: 'scheduling' | 'pipeline' | 'formbuilder' | 'designstudio' | 'doctransform' | 'chat' | 'dashboard' | 'editor' | 'checkout' | 'voicegen' | 'walkthrough'
  data?: Record<string, unknown>
}

export interface Brief {
  company: string
  domain: string
  brand: { bg: string; surface: string; text: string; muted: string; primary: string; accent: string; isDark: boolean; logo?: string; logoAspect?: number }
  fonts: { heading: string; body: string }
  pain: { headline: string; sub: string; cards: { app: string; title: string; note: string; tag: string }[]; banner: string; layout?: 'cards' | 'tabs' | 'stack' }
  reveal: { tagline: string; hero: string; layout?: 'browser' | 'split' | 'fullbleed'; bullets?: string[] }
  wow: { headline: string; sub: string; hero: string; steps: { label: string; sub: string }[]; logos: string[]; layout?: 'checklist' | 'beforeafter' | 'gallery'; gallery?: string[]; before?: string; after?: string; video?: string; captions?: string[]; productUI?: ProductUI }
  outcome: { stat: string; statLabel: string; statSub: string; cta: string; hero: string; layout?: 'stat' | 'metrics'; metrics?: { value: string; label: string }[] }
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const }
const img = (p?: string) => (p ? staticFile(p) : '')
const withAlpha = (hex: string, a: string) => hex + a

// ── Scene 1 — PAIN ───────────────────────────────────────────────────────────
// Pain palette — derived from the product's BRAND so every SaaS's problem scene is
// tinted to its own color (orange glows for Spiceform, terracotta for VScout, …),
// not the old fixed gray. Danger red is kept (problem-coded), harmonized via tint.
const painPalette = (b: Brief['brand']) => {
  const dark = b.isDark
  return {
    dark,
    bg: dark
      ? `radial-gradient(ellipse 1500px 1050px at 50% 36%, ${withAlpha(b.primary, '3a')} 0%, #0c0e12 70%)`
      : `radial-gradient(ellipse 1500px 1050px at 50% 36%, ${withAlpha(b.primary, '30')} 0%, #e7e8ec 72%)`,
    card: dark ? '#23262d' : '#ffffff',
    ink: dark ? '#e6e8ee' : '#23272f',
    muted: dark ? '#8b9099' : '#79808b',
    line: dark ? 'rgba(255,255,255,0.08)' : 'rgba(20,30,50,0.08)',
    ghost: dark ? 'rgba(255,255,255,0.05)' : 'rgba(20,30,50,0.05)',
    danger: '#e5544b',
    accent: b.primary,
  }
}
const PainHeader: React.FC<{ brief: Brief; p: ReturnType<typeof painPalette> }> = ({ brief, p }) => (
  <div style={{ position: 'absolute', top: 60, left: 0, width: '100%', textAlign: 'center', zIndex: 5 }}>
    <div style={{ color: p.ink, fontSize: 44, fontWeight: 800, letterSpacing: -0.5, fontFamily: font(brief.fonts.heading) }}>{brief.pain.headline}</div>
    <div style={{ color: p.muted, fontSize: 21, marginTop: 10 }}>{brief.pain.sub}</div>
  </div>
)
const PainBanner: React.FC<{ brief: Brief; p: ReturnType<typeof painPalette>; frame: number; fps: number }> = ({ brief, p, frame, fps }) => {
  const banner = spring({ frame: frame - 95, fps, config: { damping: 12, stiffness: 120 } })
  const shake = frame > 95 ? Math.sin((frame - 95) / 2) * interpolate(frame, [95, 130], [3, 0], clamp) : 0
  return <div style={{ position: 'absolute', bottom: 70, left: '50%', zIndex: 6, transform: `translateX(-50%) translateX(${shake}px) scale(${interpolate(banner, [0, 1], [0.9, 1], clamp)})`, opacity: interpolate(banner, [0, 1], [0, 1], clamp), background: p.danger, color: '#fff', fontSize: 24, fontWeight: 800, padding: '17px 38px', borderRadius: 13, boxShadow: `0 20px 50px ${withAlpha(p.danger, '73')}` }}>⚠ {brief.pain.banner}</div>
}

// PAIN · cards — "buried in chaos": brand-tinted, real notification cards spread to
// every quadrant with a brand accent edge, faded ghost cards filling the gaps.
export const PainCards: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand; const p = painPalette(b)
  const intro = interpolate(frame, [0, 12], [0, 1], clamp)
  const cards = (brief.pain.cards || []).slice(0, 4)
  const pos = [{ x: 96, y: 250, r: -3 }, { x: 1190, y: 196, r: 3 }, { x: 250, y: 612, r: 2.5 }, { x: 1130, y: 628, r: -2.5 }]
  const ghosts = [{ x: 690, y: 360, w: 300, h: 120, r: 2 }, { x: 1560, y: 430, w: 250, h: 110, r: -3 }, { x: 60, y: 470, w: 230, h: 100, r: 4 }, { x: 700, y: 770, w: 320, h: 120, r: -2 }, { x: 1430, y: 232, w: 220, h: 96, r: 5 }]
  const eio = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  const appearF = (i: number) => 16 + i * 18
  const base = [3, 7, 12, 5]
  // a cursor frantically roaming the cards, "clicking" each (but they never clear)
  const centers = pos.map((pp) => ({ x: pp.x + 192, y: pp.y + 78 }))
  const roamStart = 46, legDur = 32
  const ci = Math.max(0, Math.min(centers.length - 1, Math.floor((frame - roamStart) / legDur)))
  const within = eio(interpolate(frame, [roamStart + ci * legDur, roamStart + ci * legDur + legDur * 0.55], [0, 1], clamp))
  const fromC = centers[Math.max(0, ci - 1)], toC = centers[ci]
  const curX = frame < roamStart ? centers[0].x : fromC.x + (toC.x - fromC.x) * within
  const curY = frame < roamStart ? centers[0].y : fromC.y + (toC.y - fromC.y) * within
  const clickAt = (i: number) => roamStart + i * legDur + Math.round(legDur * 0.62)
  // live unread counter (bell) — climbs as cards arrive + their counts tick up
  const unread = cards.reduce((sum, _c, i) => sum + (frame >= appearF(i) ? base[i] + Math.floor((frame - appearF(i)) / 20) : 0), 0)
  const bellOp = interpolate(frame, [10, 26], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ background: p.bg, fontFamily: font(brief.fonts.body), opacity: intro }}>
      {ghosts.map((g, i) => { const s = spring({ frame: frame - (6 + i * 5), fps, config: { damping: 16, stiffness: 90 } }); return (
        <div key={'g' + i} style={{ position: 'absolute', left: g.x, top: g.y, width: g.w, height: g.h, opacity: interpolate(s, [0, 1], [0, 1], clamp) * 0.9, transform: `rotate(${g.r}deg) scale(${interpolate(s, [0, 1], [0.85, 1], clamp)})`, background: p.ghost, borderRadius: 12, border: `1px solid ${p.ghost}` }}>
          <div style={{ height: 8, width: '40%', background: p.ghost, borderRadius: 6, margin: '20px 0 0 18px' }} />
          <div style={{ height: 8, width: '70%', background: p.ghost, borderRadius: 6, margin: '14px 0 0 18px' }} />
        </div>) })}
      <PainHeader brief={brief} p={p} />
      {/* live unread counter (bell) — top-right, climbing */}
      <div style={{ position: 'absolute', top: 56, right: 70, opacity: bellOp, display: 'flex', alignItems: 'center', gap: 12, zIndex: 7 }}>
        <div style={{ position: 'relative', fontSize: 30, transform: `rotate(${Math.sin(frame / 3) * (unread > 0 ? 7 : 0)}deg)` }}>🔔
          <span style={{ position: 'absolute', top: -6, right: -10, background: p.danger, color: '#fff', fontSize: 13, fontWeight: 800, borderRadius: 20, padding: '1px 7px', minWidth: 14, textAlign: 'center' }}>{unread}</span>
        </div>
        <span style={{ color: p.muted, fontSize: 15, fontWeight: 600 }}>unread</span>
      </div>
      {cards.map((c, i) => {
        const af = appearF(i); if (frame < af - 2) return null
        const s = spring({ frame: frame - af, fps, config: { damping: 11, stiffness: 130 }, from: 0.6, to: 1 })
        const op = interpolate(frame, [af, af + 8], [0, 1], clamp)
        const fresh = frame < af + 14 // arrival flash
        // dismiss wobble when the cursor "clicks" the card (it dips, flashes, springs back)
        const ca = clickAt(i); const wob = frame >= ca && frame < ca + 16 ? Math.sin((frame - ca) / 16 * Math.PI) : 0
        const cnt = base[i] + Math.floor((frame - af) / 20)
        const pingR = frame < af + 22 ? interpolate(frame, [af, af + 22], [0, 1], clamp) : -1
        return (
          <div key={i} style={{ position: 'absolute', left: pos[i].x, top: pos[i].y, width: 384, opacity: op, transform: `rotate(${pos[i].r}deg) scale(${interpolate(s, [0, 1], [0.6, 1], clamp) - wob * 0.1})`, background: p.card, borderRadius: 14, padding: 22, borderTop: `3px solid ${fresh || wob > 0.3 ? p.danger : p.accent}`, boxShadow: (fresh || wob > 0.3) ? `0 22px 50px rgba(0,0,0,0.5), 0 0 0 2px ${withAlpha(p.danger, '66')}` : (p.dark ? '0 22px 50px rgba(0,0,0,0.5)' : '0 22px 50px rgba(30,40,60,0.16)'), border: `1px solid ${p.line}` }}>
            {/* arrival ping ring */}
            {pingR >= 0 && <div style={{ position: 'absolute', top: -10, left: -10, width: 36, height: 36, borderRadius: '50%', border: `2px solid ${p.danger}`, opacity: (1 - pingR) * 0.8, transform: `scale(${0.4 + pingR * 1.4})` }} />}
            {/* per-card unread badge */}
            <div style={{ position: 'absolute', top: -11, left: -11, background: p.danger, color: '#fff', fontSize: 13, fontWeight: 800, borderRadius: '50%', minWidth: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>{cnt}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: p.accent, fontSize: 13, fontWeight: 800, letterSpacing: 1.2 }}>{c.app}</span>
              <span style={{ background: withAlpha(p.danger, '22'), color: p.danger, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 7 }}>{c.tag}</span>
            </div>
            <div style={{ color: p.ink, fontSize: 21, fontWeight: 700, marginBottom: 7 }}>{c.title}</div>
            <div style={{ color: p.muted, fontSize: 16 }}>{c.note}</div>
          </div>
        )
      })}
      <PainBanner brief={brief} p={p} frame={frame} fps={fps} />
      {/* the overwhelmed cursor, racing between cards */}
      {frame >= roamStart - 6 && <Cursor x={curX} y={curY} clickFrames={cards.map((_c, i) => clickAt(i))} frame={frame} color={p.danger} />}
    </AbsoluteFill>
  )
}

// PAIN · tabs — "tool sprawl": one browser jammed with too many tabs of the apps
// you're juggling, over a messy spreadsheet with errors + sticky-note problems.
export const PainTabs: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand; const p = painPalette(b)
  const intro = interpolate(frame, [0, 12], [0, 1], clamp)
  const cards = (brief.pain.cards || []).slice(0, 4)
  const apps = cards.map(c => c.app)
  const tabs = [...apps, 'Sheet', 'Inbox', 'Docs', 'Drive', 'Slack', 'Notion'].slice(0, 9)
  const win = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 95 }, from: 0.95, to: 1 })
  const notePos = [{ x: 120, y: 250, r: -4 }, { x: 1140, y: 232, r: 4 }, { x: 250, y: 560, r: 3 }, { x: 1180, y: 600, r: -3 }]
  return (
    <AbsoluteFill style={{ background: p.bg, fontFamily: font(brief.fonts.body), opacity: intro }}>
      <PainHeader brief={brief} p={p} />
      {/* browser window */}
      <div style={{ position: 'absolute', left: '50%', top: 300, transform: `translateX(-50%) scale(${win})`, width: 1480, height: 560, background: p.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${p.line}`, boxShadow: p.dark ? '0 40px 90px rgba(0,0,0,0.55)' : '0 40px 90px rgba(30,40,60,0.22)' }}>
        {/* overflowing tab strip */}
        <div style={{ height: 46, background: p.dark ? '#1a1d23' : '#e9ebef', display: 'flex', alignItems: 'flex-end', paddingLeft: 12, gap: 2 }}>
          {tabs.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, maxWidth: 150, height: 34, padding: '0 12px', borderRadius: '8px 8px 0 0', background: i === 0 ? p.card : (p.dark ? '#22262d' : '#dfe2e7'), color: i === 0 ? p.ink : p.muted, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: withAlpha(p.danger, i === 0 ? 'ff' : '66'), flexShrink: 0 }} />{t}<span style={{ color: p.muted, marginLeft: 2 }}>✕</span>
            </div>
          ))}
          <div style={{ color: p.muted, fontSize: 18, padding: '0 10px', alignSelf: 'center' }}>＋</div>
          <div style={{ marginLeft: 'auto', marginRight: 14, alignSelf: 'center', background: p.danger, color: '#fff', fontSize: 12, fontWeight: 800, borderRadius: 20, padding: '2px 10px' }}>+12 more</div>
        </div>
        {/* messy spreadsheet body */}
        <div style={{ position: 'absolute', inset: '46px 0 0 0', background: p.dark ? '#16181d' : '#fbfcfd' }}>
          {Array.from({ length: 9 }, (_, r) => <div key={'r' + r} style={{ position: 'absolute', top: 46 + r * 52, left: 0, right: 0, height: 1, background: p.line }} />)}
          {Array.from({ length: 10 }, (_, c) => <div key={'c' + c} style={{ position: 'absolute', top: 0, bottom: 0, left: 60 + c * 142, width: 1, background: p.line }} />)}
          {[['#REF!', 1, 2], ['#N/A', 3, 5], ['#REF!', 5, 1], ['', 6, 7]].map((e, i) => e[0] ? <div key={'e' + i} style={{ position: 'absolute', top: 46 + (e[2] as number) * 52 + 14, left: 60 + (e[1] as number) * 142 + 10, color: p.danger, fontSize: 13, fontWeight: 800, fontFamily: 'monospace' }}>{e[0]}</div> : null)}
        </div>
      </div>
      {/* sticky-note problems slapped on top */}
      {cards.map((c, i) => { const pp = notePos[i]; const s = spring({ frame: frame - (22 + i * 9), fps, config: { damping: 14, stiffness: 120 } }); return (
        <div key={i} style={{ position: 'absolute', left: pp.x, top: pp.y, width: 320, zIndex: 4, opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `rotate(${pp.r}deg) scale(${interpolate(s, [0, 1], [0.82, 1], clamp)})`, background: p.card, borderRadius: 12, padding: 18, borderLeft: `4px solid ${p.danger}`, boxShadow: '0 18px 44px rgba(0,0,0,0.32)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: p.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{c.app}</span>
            <span style={{ background: withAlpha(p.danger, '22'), color: p.danger, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{c.tag}</span>
          </div>
          <div style={{ color: p.ink, fontSize: 18, fontWeight: 700 }}>{c.title}</div>
          <div style={{ color: p.muted, fontSize: 14, marginTop: 4 }}>{c.note}</div>
        </div>) })}
      <PainBanner brief={brief} p={p} frame={frame} fps={fps} />
    </AbsoluteFill>
  )
}

// PAIN · stack — "the tally": a centered ledger of everything you're juggling, each
// line dropping in with a red flag, building to the consequence banner.
export const PainStack: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand; const p = painPalette(b)
  const intro = interpolate(frame, [0, 12], [0, 1], clamp)
  const cards = (brief.pain.cards || []).slice(0, 4)
  const win = spring({ frame: frame - 14, fps, config: { damping: 16, stiffness: 95 }, from: 0.95, to: 1 })
  return (
    <AbsoluteFill style={{ background: p.bg, fontFamily: font(brief.fonts.body), opacity: intro }}>
      <PainHeader brief={brief} p={p} />
      <div style={{ position: 'absolute', left: '50%', top: 270, transform: `translateX(-50%) scale(${win})`, width: 900, background: p.card, borderRadius: 18, overflow: 'hidden', border: `1px solid ${p.line}`, borderTop: `4px solid ${p.accent}`, boxShadow: p.dark ? '0 40px 90px rgba(0,0,0,0.5)' : '0 40px 90px rgba(30,40,60,0.2)' }}>
        <div style={{ padding: '22px 34px', borderBottom: `1px solid ${p.line}`, color: p.muted, fontSize: 14, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>What you're juggling today</div>
        {cards.map((c, i) => { const s = spring({ frame: frame - (24 + i * 16), fps, config: { damping: 15, stiffness: 120 } }); const op = interpolate(s, [0, 1], [0, 1], clamp); if (frame < 24 + i * 16 - 2) return null; return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 34px', borderBottom: i < cards.length - 1 ? `1px solid ${p.line}` : 'none', opacity: op, transform: `translateX(${interpolate(s, [0, 1], [-20, 0], clamp)}px)` }}>
            <div style={{ width: 46, height: 46, borderRadius: 11, background: withAlpha(p.accent, '18'), color: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{c.app[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: p.muted, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{c.app}</div>
              <div style={{ color: p.ink, fontSize: 20, fontWeight: 700 }}>{c.title}</div>
            </div>
            <div style={{ color: p.muted, fontSize: 15 }}>{c.note}</div>
            <div style={{ background: withAlpha(p.danger, '20'), color: p.danger, fontSize: 13, fontWeight: 800, padding: '6px 13px', borderRadius: 8, whiteSpace: 'nowrap' }}>{c.tag}</div>
          </div>) })}
      </div>
      <PainBanner brief={brief} p={p} frame={frame} fps={fps} />
    </AbsoluteFill>
  )
}

// back-compat alias (default pain = cards)
export const PainScene = PainCards

// shared browser-chrome window with a real screenshot hero
const BrowserHero: React.FC<{ brief: Brief; src: string; w: number; h: number; scale: number; opacity: number; kb?: number; panY?: number }> = ({ brief, src, w, h, scale, opacity, kb, panY }) => {
  const b = brief.brand
  return (
    <div style={{ position: 'absolute', top: '54%', left: '50%', width: w, height: h, transform: `translate(-50%,-50%) scale(${scale})`, opacity, borderRadius: 14, overflow: 'hidden', background: b.surface, border: `1px solid ${withAlpha(b.text, '1A')}`, boxShadow: `0 50px 120px rgba(0,0,0,0.7), 0 0 90px ${withAlpha(b.primary, '33')}` }}>
      <div style={{ height: 44, background: b.surface, borderBottom: `1px solid ${withAlpha(b.text, '12')}`, display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 18 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} /><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} /><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
        <div style={{ margin: '0 auto', background: withAlpha(b.text, '10'), borderRadius: 8, padding: '5px 24px', fontSize: 14, color: b.muted }}>{brief.domain}</div>
      </div>
      <div style={{ width: '100%', height: h - 44, overflow: 'hidden', background: b.bg }}>
        {/* live Ken Burns: continuous scale + vertical pan so the product never freezes */}
        {src ? <Img src={img(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${panY ?? 24}%`, transform: `scale(${kb ?? scale})`, transformOrigin: 'center top' }} /> : null}
      </div>
    </div>
  )
}

// ── Scene 2 — REVEAL ─────────────────────────────────────────────────────────
export const RevealScene: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const wm = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90 } })
  const win = spring({ frame: frame - 16, fps, config: { damping: 16, stiffness: 90 }, from: 0.92, to: 1 })
  const winOp = interpolate(frame, [16, 34], [0, 1], clamp)
  const kb = interpolate(frame, [16, 300], [1.02, 1.10], clamp)
  const panY = interpolate(frame, [16, 300], [14, 42], clamp) // slow downward pan over the product
  const tag = interpolate(frame, [34, 54], [0, 1], clamp)
  const glow = interpolate(frame, [40, 90, 160], [0, 0.4, 0.24], clamp)
  return (
    <AbsoluteFill style={{ background: b.bg, fontFamily: font(brief.fonts.body), overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(circle, ${withAlpha(b.text, '08')} 1px, transparent 1px)`, backgroundSize: '38px 38px' }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 1100px 760px at 50% 56%, ${withAlpha(b.primary, Math.round(glow * 255).toString(16).padStart(2, '0'))} 0%, transparent 62%)` }} />
      <div style={{ position: 'absolute', top: 58, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Brandmark brief={brief} color={b.text} size={60} op={interpolate(wm, [0, 1], [0, 1], clamp)} ty={interpolate(wm, [0, 1], [20, 0], clamp)} />
        <div style={{ height: 4, width: interpolate(frame, [40, 70], [0, 240], clamp), background: b.primary, borderRadius: 2, marginTop: 12 }} />
        <div style={{ color: b.muted, fontSize: 24, marginTop: 14, opacity: tag, textAlign: 'center', maxWidth: 1100 }}>{brief.reveal.tagline}</div>
      </div>
      <BrowserHero brief={brief} src={brief.reveal.hero} w={1380} h={770} scale={win} opacity={winOp} kb={kb} panY={panY} />
    </AbsoluteFill>
  )
}

// ── Scene 3 — WOW ────────────────────────────────────────────────────────────
export const WowScene: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const bgOp = interpolate(frame, [0, 16], [0, 1], clamp)
  const kb = interpolate(frame, [0, 450], [1.04, 1.12], clamp)
  const dim = interpolate(frame, [120, 150, 300, 330], [0.25, 0.72, 0.72, 0.9], clamp)
  const title = interpolate(frame, [20, 44], [0, 1], clamp)
  const acc = accentOnDark(b)
  const steps = (brief.wow.steps || []).slice(0, 4)
  const logos = (brief.wow.logos || []).slice(0, 6)
  const trust = interpolate(frame, [320, 345], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ background: b.bg, fontFamily: font(brief.fonts.body), overflow: 'hidden' }}>
      {brief.wow.hero ? <Img src={img(brief.wow.hero)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%', transform: `scale(${kb * 1.04})`, opacity: bgOp, filter: 'blur(7px) saturate(1.1)' }} /> : null}
      <AbsoluteFill style={{ background: `rgba(${STAGE},${dim})` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 1000px 760px at 28% 46%, ${withAlpha(acc, '2A')} 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', top: 56, left: 70, opacity: title }}>
        <div style={{ color: LIGHT, fontSize: 42, fontWeight: 700, letterSpacing: -1, fontFamily: font(brief.fonts.heading), textShadow: '0 2px 14px rgba(0,0,0,0.5)' }}>{brief.wow.headline}</div>
        <div style={{ color: LMUTED, fontSize: 20, marginTop: 8 }}>{brief.wow.sub}</div>
      </div>
      <div style={{ position: 'absolute', left: 70, top: 210, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {steps.map((s, i) => {
          const t = 150 + i * 45; const sp = spring({ frame: frame - t, fps, config: { damping: 13, stiffness: 130 } })
          const chk = spring({ frame: frame - (t + 6), fps, config: { damping: 10, stiffness: 160 } })
          return (
            <div key={i} style={{ opacity: interpolate(sp, [0, 1], [0, 1], clamp), transform: `translateX(${interpolate(sp, [0, 1], [-30, 0], clamp)}px)`, display: 'flex', alignItems: 'center', gap: 16, background: withAlpha(b.surface, 'EE'), border: `1px solid ${withAlpha(acc, '55')}`, borderRadius: 12, padding: '16px 22px', width: 600, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#4cb782', color: '#06120c', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${interpolate(chk, [0, 1], [0, 1], clamp)})` }}>✓</div>
              <div><div style={{ color: b.text, fontSize: 20, fontWeight: 600 }}>{s.label}</div><div style={{ color: b.muted, fontSize: 15 }}>{s.sub}</div></div>
            </div>
          )
        })}
      </div>
      {logos.length > 0 && (
        <div style={{ position: 'absolute', bottom: 64, left: 0, right: 0, textAlign: 'center', opacity: trust }}>
          <div style={{ color: LMUTED, fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Trusted by modern teams</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 42, flexWrap: 'wrap' }}>
            {logos.map((l, i) => { const sp = spring({ frame: frame - (345 + i * 6), fps, config: { damping: 16, stiffness: 120 } }); return <span key={l} style={{ color: LIGHT, fontSize: 26, fontWeight: 700, opacity: interpolate(sp, [0, 1], [0, 0.92], clamp), transform: `translateY(${interpolate(sp, [0, 1], [12, 0], clamp)}px)`, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{l}</span> })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  )
}

// ── Scene 4 — OUTCOME / endcard (holds) ──────────────────────────────────────
export const OutcomeScene: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const kb = interpolate(frame, [0, 210], [1.06, 1.14], clamp)
  const bgOp = interpolate(frame, [0, 16], [0, 0.55], clamp)
  const scrim = interpolate(frame, [6, 26], [0, 0.92], clamp)
  const acc = accentOnDark(b)
  const wm = spring({ frame: frame - 18, fps, config: { damping: 18, stiffness: 80 } })
  const statOp = interpolate(frame, [34, 50], [0, 1], clamp)
  const subOp = interpolate(frame, [92, 110], [0, 1], clamp)
  const cta = spring({ frame: frame - 120, fps, config: { damping: 13, stiffness: 120 } })
  const ctaOp = interpolate(cta, [0, 1], [0, 1], clamp)
  const pulse = 1 + Math.sin(frame / 18) * 0.02
  return (
    <AbsoluteFill style={{ background: `rgb(${STAGE})`, fontFamily: font(brief.fonts.body) }}>
      {brief.outcome.hero ? <Img src={img(brief.outcome.hero)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 42%', transform: `scale(${kb * 1.06})`, opacity: bgOp, filter: 'blur(22px) saturate(1.15)' }} /> : null}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(${STAGE},${scrim * 0.92}) 0%, rgba(${STAGE},${scrim * 0.86}) 52%, rgba(${STAGE},${Math.min(0.98, scrim + 0.06)}) 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 920px 720px at 50% 44%, ${withAlpha(acc, '33')} 0%, transparent 62%)` }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Brandmark brief={brief} color={LIGHT} size={52} op={interpolate(wm, [0, 1], [0, 1], clamp)} ty={interpolate(wm, [0, 1], [-8, 0], clamp)} mb={24} shadow />
        <div style={{ opacity: statOp }}><span style={{ color: acc, fontSize: 150, fontWeight: 800, letterSpacing: -5, lineHeight: 1, fontFamily: font(brief.fonts.heading), textShadow: `0 6px 44px ${withAlpha(acc, '66')}` }}>{brief.outcome.stat}</span></div>
        <div style={{ opacity: subOp, color: LIGHT, fontSize: 27, marginTop: 10, fontWeight: 600 }}>{brief.outcome.statLabel}</div>
        <div style={{ opacity: subOp, color: LMUTED, fontSize: 18, marginTop: 6 }}>{brief.outcome.statSub}</div>
        <div style={{ marginTop: 46, opacity: ctaOp, transform: `scale(${pulse})`, background: acc, color: ctaText(acc), fontSize: 26, fontWeight: 700, padding: '18px 44px', borderRadius: 12, boxShadow: `0 16px 50px ${withAlpha(acc, '70')}` }}>{brief.outcome.cta}</div>
        <div style={{ marginTop: 22, color: LMUTED, fontSize: 18, opacity: ctaOp }}>{brief.domain}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE VARIANTS — distinct layouts so different SaaS look genuinely different.
// The brief picks a `layout` per scene (chosen by product category).
// ═══════════════════════════════════════════════════════════════════════════

// REVEAL · split — big wordmark + value bullets left, tilted screenshot right
export const RevealSplit: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const wm = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90 } })
  const shot = spring({ frame: frame - 18, fps, config: { damping: 17, stiffness: 80 }, from: 0.94, to: 1 })
  const shotOp = interpolate(frame, [18, 38], [0, 1], clamp)
  const kb = interpolate(frame, [18, 300], [1.0, 1.07], clamp)
  const bullets = (brief.reveal.bullets && brief.reveal.bullets.length ? brief.reveal.bullets : ['Built for purpose', 'Powered by AI', 'Made for speed']).slice(0, 3)
  const panY = interpolate(frame, [18, 234], [0, 26], clamp) // gentle top→down pan, never a hard mid-crop
  return (
    <AbsoluteFill style={{ background: b.bg, fontFamily: font(brief.fonts.body), overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 900px 800px at 18% 50%, ${withAlpha(b.primary, '22')} 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', left: 90, top: 0, bottom: 0, width: 660, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
        <Brandmark brief={brief} color={b.text} size={72} op={interpolate(wm, [0, 1], [0, 1], clamp)} ty={interpolate(wm, [0, 1], [24, 0], clamp)} />
        <div style={{ color: b.muted, fontSize: 25, marginTop: 16, lineHeight: 1.4, opacity: interpolate(frame, [24, 44], [0, 1], clamp) }}>{brief.reveal.tagline}</div>
        <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bullets.map((bl, i) => { const s = spring({ frame: frame - (50 + i * 12), fps, config: { damping: 16, stiffness: 110 } }); return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `translateX(${interpolate(s, [0, 1], [-16, 0], clamp)}px)` }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: b.primary, color: ctaText(b.primary), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>✓</span>
              <span style={{ color: b.text, fontSize: 21 }}>{bl}</span>
            </div>) })}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 70, top: '50%', width: 1000, height: 624, transform: `translateY(-50%) perspective(2200px) rotateY(-8deg) rotateX(2deg) scale(${shot})`, transformOrigin: 'left center', opacity: shotOp, borderRadius: 16, overflow: 'hidden', background: b.surface, border: `1px solid ${withAlpha(b.text, '1A')}`, boxShadow: `-22px 50px 110px rgba(0,0,0,0.55), 0 0 70px ${withAlpha(b.primary, '24')}` }}>
        <div style={{ height: 42, background: b.surface, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, borderBottom: `1px solid ${withAlpha(b.text, '12')}` }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} /><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} /><span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
          <div style={{ margin: '0 auto', background: withAlpha(b.text, '0D'), borderRadius: 7, padding: '4px 26px', fontSize: 13, color: b.muted }}>{brief.domain}</div>
        </div>
        <div style={{ width: '100%', height: 582, overflow: 'hidden', background: b.bg }}>
          {brief.reveal.hero ? <Img src={img(brief.reveal.hero)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `left ${panY}%`, transform: `scale(${kb})`, transformOrigin: 'top left' }} /> : null}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// REVEAL · fullbleed — screenshot fills frame (blurred), big centered wordmark
export const RevealFullBleed: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const b = brief.brand; const acc = accentOnDark(b)
  const kb = interpolate(frame, [0, 300], [1.08, 1.16], clamp)
  const bgOp = interpolate(frame, [0, 18], [0, 0.5], clamp)
  const wm = interpolate(frame, [14, 36], [0, 1], clamp)
  const tag = interpolate(frame, [34, 56], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ background: `rgb(${STAGE})`, fontFamily: font(brief.fonts.body) }}>
      {brief.reveal.hero ? <Img src={img(brief.reveal.hero)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})`, opacity: bgOp, filter: 'blur(14px) saturate(1.2)' }} /> : null}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(${STAGE},0.7) 0%, rgba(${STAGE},0.55) 50%, rgba(${STAGE},0.82) 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 1000px 760px at 50% 46%, ${withAlpha(acc, '2E')} 0%, transparent 62%)` }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Brandmark brief={brief} color={LIGHT} size={92} op={wm} ty={interpolate(frame, [14, 36], [22, 0], clamp)} shadow />
        <div style={{ height: 4, width: interpolate(frame, [36, 66], [0, 200], clamp), background: acc, borderRadius: 2, marginTop: 18 }} />
        <div style={{ color: LMUTED, fontSize: 28, marginTop: 20, opacity: tag, maxWidth: 1000 }}>{brief.reveal.tagline}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// WOW · beforeafter — left "before" chaos, right the real product, VS + stat
export const WowBeforeAfter: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand; const acc = accentOnDark(b)
  const title = interpolate(frame, [10, 30], [0, 1], clamp)
  const split = spring({ frame: frame - 30, fps, config: { damping: 20, stiffness: 70 } })
  const rightX = interpolate(split, [0, 1], [100, 0], clamp)
  const afterImg = brief.wow.after || brief.wow.hero
  return (
    <AbsoluteFill style={{ background: `rgb(${STAGE})`, fontFamily: font(brief.fonts.body), overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center', opacity: title }}>
        <div style={{ color: LIGHT, fontSize: 40, fontWeight: 700, fontFamily: font(brief.fonts.heading), textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{brief.wow.headline}</div>
      </div>
      {/* before */}
      <div style={{ position: 'absolute', left: 0, top: 120, bottom: 0, width: '50%', padding: '40px 50px', opacity: interpolate(frame, [20, 40], [0, 1], clamp) }}>
        <div style={{ color: '#e5544b', fontSize: 15, fontWeight: 800, letterSpacing: 2, marginBottom: 18 }}>BEFORE</div>
        {(brief.pain.cards || []).slice(0, 3).map((c, i) => { const s = spring({ frame: frame - (40 + i * 10), fps, config: { damping: 15, stiffness: 110 } }); return (
          <div key={i} style={{ opacity: interpolate(s, [0, 1], [0, 0.85], clamp), background: '#1c1f25', border: '1px solid rgba(229,84,75,0.25)', borderRadius: 10, padding: 16, marginBottom: 12, transform: `rotate(${(i % 2 ? 1 : -1) * 1.5}deg)` }}>
            <div style={{ color: '#9aa0a8', fontSize: 13, fontWeight: 700 }}>{c.app}</div>
            <div style={{ color: '#c8ccd4', fontSize: 17, marginTop: 4 }}>{c.title}</div>
            <div style={{ color: '#e5544b', fontSize: 13, marginTop: 4 }}>{c.tag}</div>
          </div>) })}
      </div>
      {/* after */}
      <div style={{ position: 'absolute', right: 0, top: 120, bottom: 0, width: '50%', padding: '40px 50px', transform: `translateX(${rightX}px)`, opacity: interpolate(split, [0, 1], [0, 1], clamp) }}>
        <div style={{ color: acc, fontSize: 15, fontWeight: 800, letterSpacing: 2, marginBottom: 18 }}>AFTER · {brief.company.toUpperCase()}</div>
        <div style={{ width: '100%', height: 460, borderRadius: 12, overflow: 'hidden', boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${withAlpha(acc, '33')}`, border: `1px solid ${withAlpha(acc, '40')}` }}>
          {afterImg ? <Img src={img(afterImg)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%' }} /> : null}
        </div>
        <div style={{ marginTop: 22, color: LIGHT, fontSize: 20 }}>{brief.wow.sub}</div>
      </div>
      {/* VS badge */}
      <div style={{ position: 'absolute', left: '50%', top: '54%', transform: `translate(-50%,-50%) scale(${interpolate(split, [0, 1], [0.6, 1], clamp)})`, width: 70, height: 70, borderRadius: '50%', background: acc, color: ctaText(acc), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, boxShadow: `0 10px 40px ${withAlpha(acc, '70')}` }}>VS</div>
    </AbsoluteFill>
  )
}

// WOW · gallery — montage grid of real section screenshots ("all in one place")
export const WowGallery: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand; const acc = accentOnDark(b)
  const title = interpolate(frame, [10, 30], [0, 1], clamp)
  const tiles = (brief.wow.gallery && brief.wow.gallery.length ? brief.wow.gallery : [brief.wow.hero]).slice(0, 6)
  return (
    <AbsoluteFill style={{ background: `rgb(${STAGE})`, fontFamily: font(brief.fonts.body), overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 1200px 800px at 50% 40%, ${withAlpha(acc, '22')} 0%, transparent 65%)` }} />
      <div style={{ position: 'absolute', top: 50, width: '100%', textAlign: 'center', opacity: title }}>
        <div style={{ color: LIGHT, fontSize: 44, fontWeight: 800, fontFamily: font(brief.fonts.heading), textShadow: '0 2px 14px rgba(0,0,0,0.5)' }}>{brief.wow.headline}</div>
        <div style={{ color: LMUTED, fontSize: 21, marginTop: 8 }}>{brief.wow.sub}</div>
      </div>
      <div style={{ position: 'absolute', top: 180, left: 70, right: 70, bottom: 60, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 22 }}>
        {tiles.map((t, i) => { const s = spring({ frame: frame - (30 + i * 12), fps, config: { damping: 16, stiffness: 110 } }); return (
          <div key={i} style={{ opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `translateY(${interpolate(s, [0, 1], [30, 0], clamp)}px) scale(${interpolate(s, [0, 1], [0.9, 1], clamp)})`, borderRadius: 12, overflow: 'hidden', border: `1px solid ${withAlpha(acc, '33')}`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', background: b.surface }}>
            {t ? <Img src={img(t)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </div>) })}
      </div>
    </AbsoluteFill>
  )
}

// OUTCOME · metrics — three stat cards + CTA (instead of one big number)
export const OutcomeMetrics: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand; const acc = accentOnDark(b)
  const kb = interpolate(frame, [0, 210], [1.06, 1.14], clamp)
  const bgOp = interpolate(frame, [0, 16], [0, 0.5], clamp)
  const scrim = interpolate(frame, [6, 26], [0, 0.92], clamp)
  const wm = interpolate(frame, [16, 34], [0, 1], clamp)
  const metrics = (brief.outcome.metrics && brief.outcome.metrics.length ? brief.outcome.metrics : [{ value: brief.outcome.stat, label: brief.outcome.statLabel }]).slice(0, 3)
  const cta = spring({ frame: frame - 120, fps, config: { damping: 13, stiffness: 120 } })
  const pulse = 1 + Math.sin(frame / 18) * 0.02
  return (
    <AbsoluteFill style={{ background: `rgb(${STAGE})`, fontFamily: font(brief.fonts.body) }}>
      {brief.outcome.hero ? <Img src={img(brief.outcome.hero)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb * 1.06})`, opacity: bgOp, filter: 'blur(22px) saturate(1.15)' }} /> : null}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(${STAGE},${scrim * 0.9}) 0%, rgba(${STAGE},${Math.min(0.97, scrim + 0.05)}) 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 900px 700px at 50% 42%, ${withAlpha(acc, '2E')} 0%, transparent 62%)` }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <Brandmark brief={brief} color={LIGHT} size={48} op={wm} mb={36} shadow />
        <div style={{ display: 'flex', gap: 30, marginBottom: 14 }}>
          {metrics.map((m, i) => { const s = spring({ frame: frame - (34 + i * 12), fps, config: { damping: 16, stiffness: 110 } }); return (
            <div key={i} style={{ opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `translateY(${interpolate(s, [0, 1], [20, 0], clamp)}px)`, background: 'rgba(255,255,255,0.04)', border: `1px solid ${withAlpha(acc, '33')}`, borderRadius: 16, padding: '28px 40px', minWidth: 240 }}>
              <div style={{ color: acc, fontSize: 72, fontWeight: 800, letterSpacing: -2, fontFamily: font(brief.fonts.heading) }}>{m.value}</div>
              <div style={{ color: LIGHT, fontSize: 19, marginTop: 6 }}>{m.label}</div>
            </div>) })}
        </div>
        <div style={{ marginTop: 36, opacity: interpolate(cta, [0, 1], [0, 1], clamp), transform: `scale(${pulse})`, background: acc, color: ctaText(acc), fontSize: 26, fontWeight: 700, padding: '18px 44px', borderRadius: 12, boxShadow: `0 16px 50px ${withAlpha(acc, '70')}` }}>{brief.outcome.cta}</div>
        <div style={{ marginTop: 20, color: LMUTED, fontSize: 18, opacity: interpolate(cta, [0, 1], [0, 1], clamp) }}>{brief.domain}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// WOW · realvideo — plays a real screen RECORDING of the product in motion
// (agent/record.ts). This is the scene that actually SHOWS the product working.
export const WowRealVideo: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand; const acc = accentOnDark(b)
  const win = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 80 }, from: 0.95, to: 1 })
  const winOp = interpolate(frame, [8, 26], [0, 1], clamp)
  const title = interpolate(frame, [0, 22], [0, 1], clamp)
  const caps = (brief.wow.captions && brief.wow.captions.length ? brief.wow.captions : (brief.wow.steps || []).map(s => s.label)).slice(0, 4)
  return (
    <AbsoluteFill style={{ background: `rgb(${STAGE})`, fontFamily: font(brief.fonts.body), overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 1100px 800px at 50% 52%, ${withAlpha(acc, '26')} 0%, transparent 62%)` }} />
      {/* headline */}
      <div style={{ position: 'absolute', top: 40, width: '100%', textAlign: 'center', opacity: title, zIndex: 5 }}>
        <div style={{ color: LIGHT, fontSize: 40, fontWeight: 700, fontFamily: font(brief.fonts.heading), textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>{brief.wow.headline}</div>
        <div style={{ color: LMUTED, fontSize: 19, marginTop: 6 }}>{brief.wow.sub}</div>
      </div>
      {/* the real product recording in a browser-chrome window */}
      <div style={{ position: 'absolute', top: '56%', left: '50%', width: 1320, height: 740, transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, borderRadius: 14, overflow: 'hidden', background: b.surface, border: `1px solid ${withAlpha(b.text, '1A')}`, boxShadow: `0 50px 120px rgba(0,0,0,0.75), 0 0 90px ${withAlpha(acc, '2A')}` }}>
        <div style={{ height: 42, background: b.surface, borderBottom: `1px solid ${withAlpha(b.text, '14')}`, display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} /><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} /><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
          <div style={{ margin: '0 auto', background: withAlpha(b.text, '10'), borderRadius: 8, padding: '5px 24px', fontSize: 13, color: b.muted }}>{brief.domain}</div>
        </div>
        <div style={{ width: '100%', height: 698, background: '#fff' }}>
          <OffthreadVideo src={staticFile(brief.wow.video as string)} muted playbackRate={0.85} trimBefore={26} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
        </div>
      </div>
      {/* animated callout pills pointing at what's happening */}
      {caps.map((c, i) => {
        const t = 70 + i * 95; const s = spring({ frame: frame - t, fps, config: { damping: 13, stiffness: 130 } })
        const op = interpolate(frame, [t, t + 14, t + 80, t + 95], [0, 1, 1, 0], clamp)
        const side = i % 2 === 0
        return (
          <div key={i} style={{ position: 'absolute', top: 150 + (i % 2) * 520, [side ? 'left' : 'right']: 90, opacity: op, transform: `translateY(${interpolate(s, [0, 1], [14, 0], clamp)}px)`, background: acc, color: ctaText(acc), fontSize: 18, fontWeight: 700, padding: '12px 20px', borderRadius: 12, boxShadow: `0 12px 34px ${withAlpha(acc, '60')}`, zIndex: 6, maxWidth: 360 }}>
            {c}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT-UI RECREATIONS — brand-themed mockups of the product's REAL screens,
// animating the core workflow. Looks like THE product (its design + colors),
// shows it actually working. This is the Wow scene done right.
// ═══════════════════════════════════════════════════════════════════════════

// animated cursor with a click ripple
const Cursor: React.FC<{ x: number; y: number; clickFrames: number[]; frame: number; color: string }> = ({ x, y, clickFrames, frame, color }) => {
  const ripple = clickFrames.find(cf => frame >= cf && frame < cf + 18)
  const rp = ripple !== undefined ? (frame - ripple) / 18 : -1
  return (
    <>
      {rp >= 0 && <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: '50%', border: `3px solid ${color}`, opacity: (1 - rp) * 0.8, transform: `scale(${0.3 + rp * 1.2})` }} />}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))', zIndex: 50 }}><path d="M4 2 L4 20 L9 15 L13 22 L16 20 L12 14 L19 14 Z" fill="#fff" stroke="#222" strokeWidth="1.2" /></svg>
    </>
  )
}

// SCHEDULING (Cal.com-style) — pick a slot → booked → synced
export const SchedulingUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, string>
  const host = d.host || 'Alex Rivera', ev = d.event || 'Product demo · 30 min', dur = d.duration || '30 min'
  const date = d.date || '12', day = d.day || 'Wed, May 12', time = d.time || '2:30 PM'
  const pr = b.primary, surf = '#ffffff', line = '#ECEDEF', ink = '#1d2430', mut = '#8a8f98'
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const ease = (a: number, b2: number) => { const p = interpolate(frame, [a, b2], [0, 1], clamp); return 1 - Math.pow(1 - p, 3) }
  // SNAPPY cursor path: date click 56 → time click 96 → confirm click 134 → booked 142
  const DATE_CLICK = 56, TIME_CLICK = 96, CONF_CLICK = 134, BOOK = 142
  let cx = 700, cy = 900
  if (frame < DATE_CLICK) { cx = 700 + (905 - 700) * ease(20, DATE_CLICK); cy = 900 + (470 - 900) * ease(20, DATE_CLICK) }
  else if (frame < TIME_CLICK) { cx = 905 + (1455 - 905) * ease(DATE_CLICK + 8, TIME_CLICK); cy = 470 + (470 - 470) * ease(DATE_CLICK + 8, TIME_CLICK) }
  else { cx = 1455 + (1455 - 1455) * ease(TIME_CLICK + 8, CONF_CLICK); cy = 470 + (690 - 470) * ease(TIME_CLICK + 8, CONF_CLICK) }
  const dateSel = frame >= DATE_CLICK, timeSel = frame >= TIME_CLICK, booked = frame >= BOOK
  const slots = ['1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM']
  const dim = booked ? interpolate(frame, [BOOK, BOOK + 16], [0, 0.5], clamp) : 0
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1200px 900px at 50% 40%, ${withAlpha(pr, '22')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef1f6'} 60%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 46, width: '100%', textAlign: 'center' }}>
        <div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '54%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1180, height: 600, background: surf, borderRadius: 18, boxShadow: '0 50px 120px rgba(20,28,46,0.4)', overflow: 'hidden', display: 'flex' }}>
        {/* left: event details */}
        <div style={{ width: 360, borderRight: `1px solid ${line}`, padding: 34 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: pr, color: ctaText(pr), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, opacity: ease(20, 40) }}>{host[0]}</div>
          <div style={{ color: mut, fontSize: 16, marginTop: 20, opacity: ease(26, 46) }}>{host}</div>
          <div style={{ color: ink, fontSize: 28, fontWeight: 700, marginTop: 6, opacity: ease(30, 50), fontFamily: font(brief.fonts.heading) }}>{ev}</div>
          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14, opacity: ease(38, 58) }}>
            {[['🕐', dur], ['📹', 'Google Meet'], ['🌐', 'America / Los Angeles']].map((r, i) => <div key={i} style={{ display: 'flex', gap: 12, color: ink, fontSize: 16 }}><span>{r[0]}</span><span>{r[1]}</span></div>)}
          </div>
          {booked && <div style={{ marginTop: 30, opacity: interpolate(frame, [150, 170], [0, 1], clamp), background: withAlpha(pr, '14'), border: `1px solid ${withAlpha(pr, '40')}`, borderRadius: 12, padding: 16 }}>
            <div style={{ color: pr, fontWeight: 800, fontSize: 18 }}>✓ Booked</div>
            <div style={{ color: ink, fontSize: 15, marginTop: 6 }}>{day} · {time}</div>
          </div>}
        </div>
        {/* right: calendar + slots */}
        <div style={{ flex: 1, padding: 34, display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: ink, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>May 2025</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <div key={'h' + i} style={{ color: mut, fontSize: 12, textAlign: 'center' }}>{w}</div>)}
              {Array.from({ length: 35 }, (_, i) => { const n = i - 3; const valid = n >= 1 && n <= 31; const isSel = valid && String(n) === date && dateSel; return (
                <div key={i} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, borderRadius: 10, color: !valid ? 'transparent' : isSel ? ctaText(pr) : ink, background: isSel ? pr : (valid && [6, 8, 12, 14, 20].includes(n) ? withAlpha(pr, '12') : 'transparent'), fontWeight: isSel ? 800 : 500, transform: isSel ? `scale(${interpolate(frame, [56, 68], [0.6, 1], clamp)})` : 'scale(1)' }}>{valid ? n : ''}</div>) })}
            </div>
          </div>
          {dateSel && <div style={{ width: 200, opacity: interpolate(frame, [64, 84], [0, 1], clamp) }}>
            <div style={{ color: ink, fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{day}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {slots.map((s, i) => { const sel = s === time && timeSel; return <div key={i} style={{ padding: '11px 0', textAlign: 'center', borderRadius: 9, fontSize: 15, fontWeight: 600, border: `1px solid ${sel ? pr : line}`, background: sel ? pr : '#fff', color: sel ? ctaText(pr) : ink }}>{s}</div> })}
            </div>
            {timeSel && <div style={{ marginTop: 14, opacity: interpolate(frame, [100, 116], [0, 1], clamp), background: pr, color: ctaText(pr), textAlign: 'center', padding: '13px 0', borderRadius: 10, fontWeight: 800, fontSize: 16, transform: `scale(${1 + (frame >= 134 && frame < 144 ? Math.sin((frame - 134) / 10 * Math.PI) * 0.04 : 0)})` }}>Confirm</div>}
          </div>}
        </div>
        {dim > 0 && <AbsoluteFill style={{ background: `rgba(20,28,46,${dim})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '34px 44px', textAlign: 'center', transform: `scale(${interpolate(frame, [146, 164], [0.8, 1], clamp)})`, boxShadow: '0 30px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: pr, color: ctaText(pr), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px' }}>✓</div>
            <div style={{ color: ink, fontSize: 26, fontWeight: 800, fontFamily: font(brief.fonts.heading) }}>You're booked!</div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Invite sent to both', 'Added to Google Calendar', 'Reminder set for 24h before'].map((t, i) => <div key={i} style={{ display: 'flex', gap: 10, color: ink, fontSize: 15, opacity: interpolate(frame, [160 + i * 12, 174 + i * 12], [0, 1], clamp) }}><span style={{ color: pr }}>✓</span>{t}</div>)}
            </div>
          </div>
        </AbsoluteFill>}
      </div>
      {!booked && <Cursor x={cx} y={cy} clickFrames={[56, 96, 134]} frame={frame} color={pr} />}
    </AbsoluteFill>
  )
}

// PIPELINE (ATS / recruiting board) — an autonomous agent advances candidates
// Sourced → Screening → Interview → Offer → Hired. Themed to the product's brand.
export const PipelineUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, string>
  const pr = b.primary, surf = '#ffffff', ink = '#221f1b', mut = '#8b8378'
  const head = '#1a1715', cream = '#f6f4f0', lane = '#f3efe9', line = '#eae5dd'
  const agent = d.agent || 'Vesper', user = d.user || 'Sara K.', org = brief.company
  const COLS = ['Sourced', 'Screening', 'Interview', 'Offer', 'Hired']
  const STAGE_C = [['#dde8ff', '#2b59c3'], ['#ece0ff', '#6b3fc0'], ['#ffeac9', '#b07016'], ['#d6f5e3', '#1f8f57'], ['#1f9d57', '#ffffff']]
  const CANDS = [
    { init: 'RK', name: 'Ravi Kapoor', role: 'Staff Designer', score: 92, target: 4, start: 10 },
    { init: 'NO', name: 'Naomi Okafor', role: 'Sr. Designer', score: 88, target: 3, start: 30 },
    { init: 'SA', name: 'Simone Achebe', role: 'QA Manager', score: 90, target: 3, start: 50 },
    { init: 'HL', name: 'Henry Liu', role: 'Product Designer', score: 81, target: 2, start: 74 },
    { init: 'AM', name: 'Aria Mendez', role: 'Designer', score: 76, target: 2, start: 98 },
    { init: 'PM', name: 'Paula Marchetti', role: 'Design Lead', score: 82, target: 1, start: 122 },
    { init: 'DR', name: 'Diego Romero', role: 'Product Designer', score: 71, target: 1, start: 150 },
  ]
  const STEP = 38
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const eio = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  const W = 1640, H = 770, PADX = 26, GAP = 12
  const colW = Math.round((W - PADX * 2 - GAP * 4) / 5)
  const colX = (i: number) => PADX + i * (colW + GAP)
  const fcol = (c: typeof CANDS[0]) => Math.min(c.target, Math.max(0, (frame - c.start) / STEP))
  const counts = COLS.map((_, i) => CANDS.filter(c => frame >= c.start && Math.round(fcol(c)) === i).length)
  const sourced = Math.round(interpolate(frame, [12, 240], [128, 503], clamp))
  const heroFc = fcol(CANDS[0]); const hired = heroFc >= 4
  const badgeOp = hired ? interpolate(frame, [168, 188], [0, 1], clamp) : 0
  const boardTop = 168, rowH = 78
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 30%, ${withAlpha(pr, '1f')} 0%, ${cream} 62%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}>
        <div style={{ color: ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: W, height: H, background: surf, borderRadius: 18, boxShadow: '0 50px 120px rgba(40,28,18,0.32)', overflow: 'hidden' }}>
        {/* app header */}
        <div style={{ height: 56, background: head, display: 'flex', alignItems: 'center', padding: '0 22px', gap: 26 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: pr, color: ctaText(pr), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17 }}>{org[0]}</div>
          {['Candidates', 'Jobs', 'Sourcing', 'Interviews'].map((t, i) => <div key={i} style={{ color: i === 0 ? '#fff' : '#9a9089', fontSize: 15, fontWeight: i === 0 ? 700 : 500 }}>{t}</div>)}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cde6d2', fontSize: 13, fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d27b', boxShadow: `0 0 ${8 + Math.sin(frame / 6) * 4}px #34d27b` }} />{agent} live · 24/7</div>
          <div style={{ background: pr, color: ctaText(pr), fontSize: 14, fontWeight: 700, padding: '7px 14px', borderRadius: 9 }}>+ Add</div>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#3a332d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{user.split(' ').map(s => s[0]).join('')}</div>
        </div>
        {/* page title + live stat strip */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 26px 12px', gap: 18 }}>
          <div style={{ color: ink, fontSize: 26, fontWeight: 800, fontFamily: font(brief.fonts.heading) }}>Candidates</div>
          <div style={{ flex: 1 }} />
          {[[`${sourced}`, 'sourced'], ['78%', 'of weekly target'], ['3', 'scorecards ready']].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 7, opacity: interpolate(frame, [8, 26], [0, 1], clamp) }}>
              <span style={{ color: pr, fontSize: 20, fontWeight: 800 }}>{s[0]}</span><span style={{ color: mut, fontSize: 13 }}>{s[1]}</span>
              {i < 2 && <span style={{ color: line, marginLeft: 10 }}>|</span>}
            </div>
          ))}
        </div>
        {/* column headers */}
        <div style={{ position: 'absolute', top: 112, left: 0, width: '100%', height: 44 }}>
          {COLS.map((c, i) => (
            <div key={i} style={{ position: 'absolute', left: colX(i), width: colW, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: STAGE_C[i][i === 4 ? 0 : 1] }} />
              <span style={{ color: ink, fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>{c}</span>
              <span style={{ background: lane, color: mut, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>{counts[i]}</span>
            </div>
          ))}
          {/* lane backgrounds */}
          {COLS.map((_, i) => <div key={'l' + i} style={{ position: 'absolute', top: 44, left: colX(i), width: colW, height: rowH * CANDS.length + 8, background: lane, borderRadius: 12, opacity: 0.6 }} />)}
        </div>
        {/* candidate cards (slide along their lane as the agent advances them) */}
        {CANDS.map((c, r) => {
          if (frame < c.start) return null
          const fc = fcol(c); const col = Math.floor(fc); const frac = fc - col; const next = Math.min(col + 1, c.target)
          const x = colX(col) + (colX(next) - colX(col)) * eio(frac)
          const stage = Math.round(fc); const sc = STAGE_C[stage]
          const op = interpolate(frame, [c.start, c.start + 10], [0, 1], clamp)
          const pop = spring({ frame: frame - c.start, fps, config: { damping: 14, stiffness: 120 }, from: 0.8, to: 1 })
          const isHired = c.target === 4 && fc >= 4
          return (
            <div key={r} style={{ position: 'absolute', top: boardTop + r * rowH, left: x + 8, width: colW - 16, height: rowH - 12, background: surf, border: `1px solid ${isHired ? '#1f9d57' : line}`, boxShadow: isHired ? '0 8px 26px rgba(31,157,87,0.28)' : '0 4px 14px rgba(40,28,18,0.07)', borderRadius: 11, opacity: op, transform: `scale(${pop})`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: withAlpha(pr, '22'), color: pr, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{c.init}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: ink, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ color: mut, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.role}</div>
              </div>
              {stage >= 1 && <div style={{ color: c.score >= 85 ? '#1f8f57' : ink, fontSize: 14, fontWeight: 800, opacity: interpolate(frame, [c.start + STEP, c.start + STEP + 14], [0, 1], clamp) }}>{c.score}</div>}
              <div style={{ background: sc[0], color: sc[1], fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{isHired ? '✓ Hired' : COLS[stage]}</div>
            </div>
          )
        })}
        {/* hired badge */}
        {badgeOp > 0 && <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: `translateX(-50%) scale(${interpolate(frame, [168, 186], [0.85, 1], clamp)})`, opacity: badgeOp, background: head, color: '#fff', fontSize: 18, fontWeight: 800, padding: '14px 26px', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: '#34d27b', fontSize: 20 }}>✓</span>{d.badge || `Hired in 9 days — ${agent} did the busywork`}</div>}
      </div>
    </AbsoluteFill>
  )
}

// FORM BUILDER (AI form generator) — type a prompt → AI builds a branded form,
// field by field, with logic/CRM/analytics. Themed to the product's brand.
export const FormBuilderUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, string>
  const pr = b.primary, surf = '#ffffff', ink = '#1c1b1f', mut = '#8a8780', line = '#ececef', rail = '#f7f7f9'
  const prompt = d.prompt || 'Client intake form for a design studio'
  const formTitle = d.formTitle || 'Project intake'
  type F = { label: string; type: string; ph?: string; opts?: string[]; logic?: boolean }
  const FIELDS: F[] = [
    { label: 'Full name', type: 'text', ph: 'Jane Cooper' },
    { label: 'Work email', type: 'text', ph: 'jane@studio.com' },
    { label: 'Project type', type: 'select', opts: ['Branding', 'Website', 'Product'], logic: true },
    { label: 'Budget', type: 'radio', opts: ['<$5k', '$5–20k', '$20k+'] },
    { label: 'About the project', type: 'textarea', ph: 'A few sentences…' },
  ]
  const ACTIONS = ['Generated 5 questions', 'Added branching logic', 'Connected to CRM', 'Analytics enabled']
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  // type the prompt, click Generate, AI builds the form
  const typed = prompt.slice(0, Math.max(0, Math.min(prompt.length, Math.floor((frame - 10) / 1.3))))
  const typeEnd = 10 + prompt.length * 1.3
  const GEN = 64
  const generating = frame >= GEN && frame < 88
  const built = frame >= 88
  const caret = frame < typeEnd && Math.floor(frame / 8) % 2 === 0
  const cx = frame < GEN - 6 ? 250 + interpolate(frame, [10, GEN - 6], [0, 120], clamp) : 250
  const cy = frame < GEN - 6 ? 322 : 322 + interpolate(frame, [GEN - 6, GEN], [0, 78], clamp)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 32%, ${withAlpha(pr, '1c')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef0f4'} 62%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}>
        <div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1520, height: 720, background: surf, borderRadius: 18, boxShadow: '0 50px 120px rgba(20,20,30,0.34)', overflow: 'hidden', display: 'flex' }}>
        {/* left rail: prompt + AI build log */}
        <div style={{ width: 470, background: rail, borderRight: `1px solid ${line}`, padding: 30, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: pr, fontSize: 14, fontWeight: 800, letterSpacing: 0.3 }}><span style={{ fontSize: 16 }}>✦</span>{brief.company} AI</div>
          <div style={{ color: mut, fontSize: 13, margin: '18px 0 8px', fontWeight: 600 }}>Describe your form</div>
          <div style={{ background: surf, border: `2px solid ${frame < GEN ? pr : line}`, borderRadius: 12, padding: '14px 16px', minHeight: 78, color: ink, fontSize: 17, lineHeight: 1.35 }}>
            {typed}<span style={{ opacity: caret ? 1 : 0, color: pr, fontWeight: 700 }}>|</span>
          </div>
          <div style={{ marginTop: 14, background: pr, color: ctaText(pr), borderRadius: 11, padding: '13px 0', textAlign: 'center', fontWeight: 800, fontSize: 16, boxShadow: `0 10px 26px ${withAlpha(pr, '55')}` }}>
            {generating ? `Generating${'.'.repeat((Math.floor(frame / 6) % 3) + 1)}` : built ? '✓ Form ready' : '✦ Generate'}
          </div>
          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ACTIONS.map((a, i) => { const t = 96 + i * 30; const s = spring({ frame: frame - t, fps, config: { damping: 15, stiffness: 120 } }); return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `translateX(${interpolate(s, [0, 1], [-14, 0], clamp)}px)` }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#27c285', color: '#04130b', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${interpolate(s, [0, 1], [0, 1], clamp)})` }}>✓</span>
                <span style={{ color: ink, fontSize: 15, fontWeight: 600 }}>{a}</span>
              </div>) })}
          </div>
        </div>
        {/* right: live branded form preview, building field by field */}
        <div style={{ flex: 1, position: 'relative', background: surf, padding: '34px 56px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: pr }} />
          <div style={{ color: ink, fontSize: 30, fontWeight: 800, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [88, 104], [0, 1], clamp), transform: `translateY(${interpolate(frame, [88, 104], [10, 0], clamp)}px)` }}>{formTitle}</div>
          <div style={{ color: mut, fontSize: 15, marginTop: 4, opacity: interpolate(frame, [92, 108], [0, 1], clamp) }}>Tell us about your project — takes 1 minute.</div>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FIELDS.map((f, i) => { const t = 96 + i * 24; const s = spring({ frame: frame - t, fps, config: { damping: 15, stiffness: 120 } }); const op = interpolate(s, [0, 1], [0, 1], clamp); if (frame < t - 2) return null; return (
              <div key={i} style={{ opacity: op, transform: `translateY(${interpolate(s, [0, 1], [14, 0], clamp)}px)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <span style={{ color: ink, fontSize: 15, fontWeight: 700 }}>{f.label}</span>
                  {f.logic && <span style={{ background: withAlpha(pr, '1a'), color: pr, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, transform: `scale(${interpolate(frame, [t + 8, t + 18], [0, 1], clamp)})` }}>⎇ logic</span>}
                </div>
                {f.type === 'text' && <div style={{ border: `1.5px solid ${line}`, borderRadius: 9, padding: '11px 14px', color: mut, fontSize: 15 }}>{f.ph}</div>}
                {f.type === 'textarea' && <div style={{ border: `1.5px solid ${line}`, borderRadius: 9, padding: '11px 14px', color: mut, fontSize: 15, height: 54 }}>{f.ph}</div>}
                {f.type === 'select' && <div style={{ border: `1.5px solid ${line}`, borderRadius: 9, padding: '11px 14px', color: ink, fontSize: 15, display: 'flex', justifyContent: 'space-between' }}><span>{(f.opts || []).join('  ·  ')}</span><span style={{ color: mut }}>▾</span></div>}
                {f.type === 'radio' && <div style={{ display: 'flex', gap: 10 }}>{(f.opts || []).map((o, j) => <div key={j} style={{ flex: 1, textAlign: 'center', border: `1.5px solid ${j === 1 ? pr : line}`, background: j === 1 ? withAlpha(pr, '12') : surf, color: j === 1 ? pr : ink, borderRadius: 9, padding: '10px 0', fontSize: 14, fontWeight: 600 }}>{o}</div>)}</div>}
              </div>) })}
          </div>
          <div style={{ marginTop: 22, opacity: interpolate(frame, [200, 216], [0, 1], clamp), transform: `scale(${interpolate(frame, [200, 216], [0.92, 1], clamp)})`, display: 'inline-block', background: pr, color: ctaText(pr), fontWeight: 800, fontSize: 16, padding: '13px 30px', borderRadius: 10, boxShadow: `0 12px 30px ${withAlpha(pr, '55')}` }}>Submit →</div>
          {frame >= 208 && <div style={{ position: 'absolute', bottom: 26, right: 34, opacity: interpolate(frame, [208, 224], [0, 1], clamp), transform: `translateY(${interpolate(frame, [208, 224], [10, 0], clamp)}px)`, background: ink, color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 18px', borderRadius: 11, boxShadow: '0 14px 36px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: pr }}>⚡</span>{d.badge || 'Generated in 4s'}</div>}
        </div>
      </div>
      {frame < GEN + 4 && <Cursor x={cx} y={cy} clickFrames={[GEN]} frame={frame} color={pr} />}
    </AbsoluteFill>
  )
}

// DESIGN STUDIO (AI design marketplace) — describe a space → AI renders a design
// (real imagery revealed) → matched with pros. Themed to the product's brand.
export const DesignStudioUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, string>
  const pr = b.primary, surf = '#ffffff', ink = '#1d2533', mut = '#8a8478', line = '#ece6dd', cream = '#f8f1e8'
  const prompt = d.prompt || 'Cozy Scandinavian living room, walnut accents'
  const image = d.image || 'real/dexo/img_5.png'
  const styles = ['Scandinavian', 'Modern', 'Japandi', 'Boho']
  const pins = (d.pins ? String(d.pins).split('|') : ['Walnut shelving', 'Linen sofa', 'Warm lighting']).slice(0, 3)
  const pinPos = [{ x: 0.24, y: 0.3 }, { x: 0.66, y: 0.5 }, { x: 0.38, y: 0.76 }]
  const pros = [{ n: 'Maya Okonkwo', r: 'Interior designer', s: '4.9' }, { n: 'Tomás Vidal', r: 'Carpenter', s: '4.8' }, { n: 'Lena Hart', r: 'Decorator', s: '5.0' }]
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const typed = prompt.slice(0, Math.max(0, Math.min(prompt.length, Math.floor((frame - 10) / 1.2))))
  const typeEnd = 10 + prompt.length * 1.2
  const GEN = 64, generating = frame >= GEN && frame < 88, built = frame >= 88
  const caret = frame < typeEnd && Math.floor(frame / 8) % 2 === 0
  const reveal = interpolate(frame, [88, 150], [0, 1], clamp)   // AI render: blur→sharp
  const sweep = interpolate(frame, [88, 128], [-30, 130], clamp)
  const cx = frame < GEN - 6 ? 230 + interpolate(frame, [10, GEN - 6], [0, 90], clamp) : 230
  const cy = frame < GEN - 6 ? 300 : 300 + interpolate(frame, [GEN - 6, GEN], [0, 96], clamp)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 32%, ${withAlpha(pr, '1e')} 0%, ${cream} 64%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}>
        <div style={{ color: ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1560, height: 720, background: surf, borderRadius: 18, boxShadow: '0 50px 120px rgba(50,35,22,0.32)', overflow: 'hidden', display: 'flex' }}>
        {/* left: prompt + matched pros */}
        <div style={{ width: 430, background: cream, borderRight: `1px solid ${line}`, padding: 30, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: pr, fontSize: 14, fontWeight: 800 }}><span style={{ fontSize: 16 }}>✦</span>{brief.company} Studio</div>
          <div style={{ color: mut, fontSize: 13, margin: '18px 0 8px', fontWeight: 600 }}>Describe your space</div>
          <div style={{ background: surf, border: `2px solid ${frame < GEN ? pr : line}`, borderRadius: 12, padding: '13px 15px', minHeight: 66, color: ink, fontSize: 16, lineHeight: 1.35 }}>{typed}<span style={{ opacity: caret ? 1 : 0, color: pr, fontWeight: 700 }}>|</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {styles.map((s, i) => { const sp = interpolate(frame, [20 + i * 5, 34 + i * 5], [0, 1], clamp); return <span key={i} style={{ opacity: sp, fontSize: 13, fontWeight: 700, padding: '7px 13px', borderRadius: 20, border: `1.5px solid ${i === 0 ? pr : line}`, background: i === 0 ? withAlpha(pr, '14') : surf, color: i === 0 ? pr : mut }}>{s}</span> })}
          </div>
          <div style={{ marginTop: 16, background: pr, color: ctaText(pr), borderRadius: 11, padding: '13px 0', textAlign: 'center', fontWeight: 800, fontSize: 16, boxShadow: `0 10px 26px ${withAlpha(pr, '55')}` }}>{generating ? `Designing${'.'.repeat((Math.floor(frame / 6) % 3) + 1)}` : built ? '✓ Design ready' : '✦ Generate design'}</div>
          <div style={{ color: mut, fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', margin: '26px 0 12px', opacity: interpolate(frame, [150, 166], [0, 1], clamp) }}>Matched with pros</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pros.map((p, i) => { const t = 154 + i * 20; const s = spring({ frame: frame - t, fps, config: { damping: 15, stiffness: 120 } }); return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `translateX(${interpolate(s, [0, 1], [-14, 0], clamp)}px)`, background: surf, border: `1px solid ${line}`, borderRadius: 12, padding: '10px 13px' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: withAlpha(pr, '20'), color: pr, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{p.n.split(' ').map(x => x[0]).join('')}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: ink, fontSize: 15, fontWeight: 700 }}>{p.n}</div><div style={{ color: mut, fontSize: 12 }}>{p.r}</div></div>
                <div style={{ color: pr, fontSize: 13, fontWeight: 800 }}>★ {p.s}</div>
              </div>) })}
          </div>
        </div>
        {/* right: AI design canvas */}
        <div style={{ flex: 1, position: 'relative', background: '#efe7dc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 640, height: 600, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(40,28,16,0.3)', background: cream }}>
            {!built && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: mut, fontSize: 15, border: `2px dashed ${line}`, borderRadius: 16 }}>Your design appears here</div>}
            {built && <>
              <Img src={img(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: `blur(${(1 - reveal) * 16}px) brightness(${0.7 + reveal * 0.3})`, transform: `scale(${1.06 - reveal * 0.06})` }} />
              {reveal < 1 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sweep}%`, width: 80, background: `linear-gradient(90deg, transparent, ${withAlpha('#ffffff', '88')}, transparent)` }} />}
              {pins.map((pn, i) => { const t = 132 + i * 18; const s = spring({ frame: frame - t, fps, config: { damping: 14, stiffness: 130 } }); return (
                <div key={i} style={{ position: 'absolute', left: `${pinPos[i].x * 100}%`, top: `${pinPos[i].y * 100}%`, opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `translate(-50%,-50%) scale(${interpolate(s, [0, 1], [0.6, 1], clamp)})`, display: 'flex', alignItems: 'center', gap: 7, background: withAlpha('#1d2533', 'd9'), color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 20, boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: pr }} />{pn}</div>) })}
            </>}
          </div>
          {frame >= 200 && <div style={{ position: 'absolute', bottom: 28, right: 30, opacity: interpolate(frame, [200, 216], [0, 1], clamp), transform: `translateY(${interpolate(frame, [200, 216], [10, 0], clamp)}px)`, background: '#1d2533', color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 18px', borderRadius: 11, boxShadow: '0 14px 36px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: pr }}>✦</span>{d.badge || 'Designed in 12s'}</div>}
        </div>
      </div>
      {frame < GEN + 4 && <Cursor x={cx} y={cy} clickFrames={[GEN]} frame={frame} color={pr} />}
    </AbsoluteFill>
  )
}

// DOC TRANSFORM (AI input → output) — drop a lecture/PDF → AI transcribes & analyzes
// → a structured notebook BUILDS ITSELF section by section. The archetype for
// summarizers / note tools / AI writers / "upload → generated document" products.
export const DocTransformUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, unknown>
  const pr = b.primary
  const shell = b.isDark ? b.surface : '#ffffff'
  const shellInk = b.isDark ? b.text : '#1d1b18'
  const shellMut = b.muted
  const rail = b.isDark ? 'rgba(255,255,255,0.04)' : '#f6f4f0'
  const line = b.isDark ? 'rgba(255,255,255,0.10)' : '#ece7df'
  const head = b.isDark ? '#16130f' : '#1e1b17'
  const paper = '#ffffff', pInk = '#1d1b18', pMut = '#8a857c', pLine = '#f0e9f0'
  const mark = lum(pr) < 0.6 ? pr : '#e35d4b' // readable highlight on white paper
  const source = (d.source as string) || 'Lecture 07 — Clustering.mp3'
  const srcIcon = (d.sourceType === 'pdf' ? '📄' : d.sourceType === 'slides' ? '📊' : '🎧')
  const title = (d.notebookTitle as string) || 'Clustering — Overview'
  const sections = (d.sections as { heading: string; points: string[] }[]) || [
    { heading: 'Overview', points: ['K-means partitions points into K groups', 'Hierarchical builds a cluster tree'] },
    { heading: 'Key idea', points: ['Minimize within-cluster distance', 'Pick K with the elbow method'] },
    { heading: 'Summary', points: ['Use K-means for speed, hierarchical for structure'] },
  ]
  const term = (d.term as string) || 'Elbow method'
  const actions = ['Transcribed 52 min', 'Found 6 key topics', 'Extracted key points', 'Built study notebook']
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const DROP = 24, procEnd = 86
  const dropped = frame >= DROP
  const proc = interpolate(frame, [DROP + 4, procEnd], [0, 1], clamp)
  const building = frame >= procEnd
  const procOp = interpolate(frame, [procEnd, procEnd + 12], [1, 0], clamp)
  const dir = brief.fonts.heading === 'heebo' ? 'rtl' : 'ltr'
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 32%, ${withAlpha(pr, b.isDark ? '24' : '1c')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef0f4'} 64%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}>
        <div style={{ color: b.isDark ? LIGHT : '#1d2533', fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1560, height: 720, background: shell, borderRadius: 18, boxShadow: '0 50px 120px rgba(20,16,10,0.4)', overflow: 'hidden', display: 'flex', border: `1px solid ${line}` }}>
        {/* left: upload + AI build log */}
        <div style={{ width: 440, background: rail, borderRight: `1px solid ${line}`, padding: 30, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: pr, fontSize: 14, fontWeight: 800 }}><span style={{ fontSize: 16 }}>✦</span>{brief.company} AI</div>
          <div style={{ color: shellMut, fontSize: 13, margin: '18px 0 10px', fontWeight: 600 }}>Drop your lecture</div>
          <div style={{ height: 96, border: `2px dashed ${dropped ? pr : line}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dropped ? withAlpha(pr, '12') : 'transparent', transition: 'none' }}>
            {dropped ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, transform: `scale(${interpolate(frame, [DROP, DROP + 8], [0.8, 1], clamp)})` }}>
                <span style={{ fontSize: 22 }}>{srcIcon}</span>
                <span style={{ color: shellInk, fontSize: 14, fontWeight: 600 }}>{source}</span>
              </div>
            ) : <span style={{ color: shellMut, fontSize: 14 }}>drag a recording, PDF or slides</span>}
          </div>
          {/* processing meters */}
          {dropped && !building && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: shellInk, fontSize: 13, fontWeight: 600, marginBottom: 8 }}><span>Transcribing & analyzing…</span><span style={{ color: pr }}>{Math.round(proc * 100)}%</span></div>
              <div style={{ height: 8, background: line, borderRadius: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: `${proc * 100}%`, background: pr, borderRadius: 5 }} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34, marginTop: 14 }}>
                {Array.from({ length: 30 }, (_, i) => <div key={i} style={{ flex: 1, height: `${20 + Math.abs(Math.sin(frame / 4 + i * 0.6)) * 80}%`, background: withAlpha(pr, '99'), borderRadius: 2 }} />)}
              </div>
            </div>
          )}
          {/* AI build log */}
          {building && (
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 13 }}>
              {actions.map((a, i) => { const t = procEnd + 6 + i * 22; const s = spring({ frame: frame - t, fps, config: { damping: 15, stiffness: 120 } }); return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: interpolate(s, [0, 1], [0, 1], clamp), transform: `translateX(${interpolate(s, [0, 1], [-12, 0], clamp)}px)` }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#27c285', color: '#04130b', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${interpolate(s, [0, 1], [0, 1], clamp)})` }}>✓</span>
                  <span style={{ color: shellInk, fontSize: 15, fontWeight: 600 }}>{a}</span>
                </div>) })}
            </div>
          )}
        </div>
        {/* right: the notebook page building itself (white paper) */}
        <div style={{ flex: 1, position: 'relative', background: '#efe9e1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', background: paper, borderRadius: 12, boxShadow: '0 24px 60px rgba(40,28,16,0.22)', overflow: 'hidden' }}>
            {/* ruled grid */}
            {Array.from({ length: 14 }, (_, r) => <div key={r} style={{ position: 'absolute', left: 0, right: 0, top: 70 + r * 44, height: 1, background: pLine }} />)}
            {/* processing veil */}
            {procOp > 0.01 && <div style={{ position: 'absolute', inset: 0, background: paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: procOp, zIndex: 3 }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', border: `4px solid ${withAlpha(mark, '33')}`, borderTopColor: mark, transform: `rotate(${frame * 14}deg)` }} />
              <div style={{ color: pMut, fontSize: 16, marginTop: 18, fontWeight: 600 }}>Generating your notebook…</div>
            </div>}
            {/* the notebook content */}
            <div dir={dir} style={{ position: 'relative', zIndex: 2, padding: '34px 44px', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              <div style={{ color: pInk, fontSize: 30, fontWeight: 800, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [88, 104], [0, 1], clamp), transform: `translateY(${interpolate(frame, [88, 104], [10, 0], clamp)}px)`, borderBottom: `3px solid ${mark}`, paddingBottom: 10, display: 'inline-block' }}>{title}</div>
              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {sections.map((sec, i) => { const t = 100 + i * 40; const hs = spring({ frame: frame - t, fps, config: { damping: 15, stiffness: 120 } }); if (frame < t - 2) return null; return (
                  <div key={i} style={{ opacity: interpolate(hs, [0, 1], [0, 1], clamp), transform: `translateY(${interpolate(hs, [0, 1], [12, 0], clamp)}px)` }}>
                    <div style={{ color: mark, fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{sec.heading}</div>
                    {sec.points.map((pt, j) => { const pt0 = t + 10 + j * 12; return (
                      <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 7, opacity: interpolate(frame, [pt0, pt0 + 12], [0, 1], clamp), flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                        <span style={{ color: mark, fontWeight: 800, lineHeight: 1.5 }}>•</span>
                        <span style={{ color: pInk, fontSize: 17, lineHeight: 1.5 }}>{pt}</span>
                      </div>) })}
                  </div>) })}
              </div>
              {/* highlighted key term */}
              {frame >= 196 && <div style={{ marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 10, opacity: interpolate(frame, [196, 212], [0, 1], clamp), transform: `scale(${interpolate(frame, [196, 212], [0.9, 1], clamp)})`, background: withAlpha(mark, '1e'), border: `1.5px solid ${mark}`, borderRadius: 10, padding: '10px 16px' }}>
                <span style={{ color: mark, fontWeight: 800, fontSize: 13 }}>★ KEY TERM</span>
                <span style={{ color: pInk, fontSize: 16, fontWeight: 700 }}>{term}</span>
              </div>}
            </div>
          </div>
          {frame >= 234 && <div style={{ position: 'absolute', bottom: 26, right: 30, opacity: interpolate(frame, [234, 250], [0, 1], clamp), transform: `translateY(${interpolate(frame, [234, 250], [10, 0], clamp)}px)`, background: head, color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 18px', borderRadius: 11, boxShadow: '0 14px 36px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ color: pr }}>✦</span>{(d.badge as string) || 'Notebook ready in 40s'}</div>}
        </div>
      </div>
      {frame < DROP + 4 && <Cursor x={470} y={interpolate(frame, [4, DROP], [360, 470], clamp)} clickFrames={[DROP]} frame={frame} color={pr} />}
    </AbsoluteFill>
  )
}

// CHAT / ASSISTANT — a customer asks → the AI thinks → a grounded answer streams in
// with citation chips. The archetype for support bots, AI assistants, copilots, search.
export const ChatUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, unknown>
  const pr = b.primary, surf = b.isDark ? b.surface : '#ffffff', ink = b.isDark ? b.text : '#1d2430', mut = b.muted
  const line = b.isDark ? 'rgba(255,255,255,0.09)' : '#ececf0', userBg = withAlpha(pr, b.isDark ? '2a' : '18')
  const question = (d.question as string) || 'Do you offer a free trial, and how fast can I get set up?'
  const answer = (d.answer as string) || 'Yes — 14-day free trial, no card needed. Most teams are live in ~11 minutes: add one script tag, point us at your site, and the assistant answers from your own docs.'
  const sources = (d.sources as string[]) || ['Pricing', 'Setup guide', 'FAQ']
  const dir = brief.fonts.heading === 'heebo' ? 'rtl' : 'ltr'
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const typed = question.slice(0, Math.max(0, Math.min(question.length, Math.floor((frame - 10) / 0.9))))
  const SEND = Math.max(10 + question.length * 0.9 + 4, 50)
  const sent = frame >= SEND
  const thinking = sent && frame < SEND + 28
  const sStart = SEND + 28
  const shown = frame >= sStart ? answer.slice(0, Math.floor((frame - sStart) / 0.7)) : ''
  const done = frame >= sStart + answer.length * 0.7
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1200px 900px at 50% 36%, ${withAlpha(pr, '22')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef1f6'} 62%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 46, width: '100%', textAlign: 'center' }}><div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div></div>
      <div dir={dir} style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 860, height: 600, background: surf, borderRadius: 20, boxShadow: '0 50px 120px rgba(20,28,46,0.4)', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${line}` }}>
        <div style={{ height: 60, borderBottom: `1px solid ${line}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: pr, color: ctaText(pr), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{brief.company[0]}</div>
          <div><div style={{ color: ink, fontSize: 16, fontWeight: 700 }}>{brief.company} Assistant</div><div style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>● online</div></div>
        </div>
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sent && <div style={{ alignSelf: 'flex-end', maxWidth: '78%', background: userBg, color: ink, fontSize: 17, padding: '13px 17px', borderRadius: '16px 16px 4px 16px', transform: `scale(${interpolate(frame, [SEND, SEND + 8], [0.9, 1], clamp)})` }}>{question}</div>}
          {thinking && <div style={{ alignSelf: 'flex-start', background: b.isDark ? '#22262d' : '#f1f3f6', borderRadius: '16px 16px 16px 4px', padding: '15px 18px', display: 'flex', gap: 6 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: mut, opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 6 + i)) }} />)}</div>}
          {frame >= sStart && <div style={{ alignSelf: 'flex-start', maxWidth: '82%', background: b.isDark ? '#22262d' : '#f1f3f6', color: ink, fontSize: 17, lineHeight: 1.5, padding: '15px 18px', borderRadius: '16px 16px 16px 4px' }}>{shown}{!done && <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: pr }}>▍</span>}
            {done && <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>{sources.map((s, i) => <span key={i} style={{ opacity: interpolate(frame, [sStart + answer.length * 0.7 + i * 6, sStart + answer.length * 0.7 + 12 + i * 6], [0, 1], clamp), fontSize: 12, fontWeight: 700, color: pr, background: withAlpha(pr, '18'), border: `1px solid ${withAlpha(pr, '40')}`, borderRadius: 7, padding: '4px 10px' }}>↗ {s}</span>)}</div>}
          </div>}
        </div>
        <div style={{ borderTop: `1px solid ${line}`, padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, background: b.isDark ? '#1a1d23' : '#f1f3f6', borderRadius: 12, padding: '13px 16px', color: sent ? mut : ink, fontSize: 16 }}>{sent ? 'Ask anything…' : <>{typed}<span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: pr }}>|</span></>}</div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: pr, color: ctaText(pr), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>➤</div>
        </div>
      </div>
      {done && <div style={{ position: 'absolute', bottom: 70, left: '50%', transform: 'translateX(-50%)', opacity: interpolate(frame, [done ? sStart + answer.length * 0.7 + 30 : 9999, sStart + answer.length * 0.7 + 46], [0, 1], clamp), background: b.isDark ? '#0e1014' : '#1d2430', color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 20px', borderRadius: 11, display: 'flex', gap: 9 }}><span style={{ color: pr }}>✦</span>{(d.badge as string) || 'Answered in 1.2s — grounded in your docs'}</div>}
    </AbsoluteFill>
  )
}

// DASHBOARD / ANALYTICS — KPIs count up and a chart draws itself live.
export const DashboardUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, unknown>
  const pr = b.primary, surf = b.isDark ? b.surface : '#ffffff', ink = b.isDark ? b.text : '#1d2430', mut = b.muted
  const line = b.isDark ? 'rgba(255,255,255,0.08)' : '#eceef2', head = b.isDark ? '#16130f' : '#1b2433'
  const metrics = (d.metrics as { label: string; prefix?: string; value: number; suffix?: string; delta?: string }[]) || [
    { label: 'Revenue', prefix: '$', value: 48200, suffix: '', delta: '+18%' },
    { label: 'Active users', value: 12840, delta: '+9%' },
    { label: 'Conversion', value: 4.7, suffix: '%', delta: '+0.6' },
  ]
  const bars = (d.bars as number[]) || [40, 62, 51, 78, 66, 90, 84, 100, 72]
  const fmt = (n: number) => (n % 1 === 0 ? Math.round(n).toLocaleString() : n.toFixed(1))
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 32%, ${withAlpha(pr, '1e')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef1f6'} 64%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}><div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div></div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1500, height: 700, background: surf, borderRadius: 18, boxShadow: '0 50px 120px rgba(20,28,46,0.34)', overflow: 'hidden', border: `1px solid ${line}` }}>
        <div style={{ height: 56, background: head, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 24 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: pr, color: ctaText(pr), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{brief.company[0]}</div>
          {['Overview', 'Reports', 'Audience'].map((t, i) => <span key={i} style={{ color: i === 0 ? '#fff' : '#9aa1ad', fontSize: 15, fontWeight: i === 0 ? 700 : 500 }}>{t}</span>)}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: '#cde6d2', fontSize: 13, fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d27b', boxShadow: `0 0 ${8 + Math.sin(frame / 6) * 4}px #34d27b` }} />Live · this month</div>
        </div>
        <div style={{ padding: 28, display: 'flex', gap: 18 }}>
          {metrics.slice(0, 3).map((m, i) => { const t = 24 + i * 10; const p = interpolate(frame, [t, t + 50], [0, 1], { ...clamp, easing: undefined }); const v = m.value * (1 - Math.pow(1 - p, 3)); return (
            <div key={i} style={{ flex: 1, background: b.isDark ? '#22262d' : '#f8fafc', border: `1px solid ${line}`, borderRadius: 14, padding: 22, opacity: interpolate(frame, [t, t + 12], [0, 1], clamp) }}>
              <div style={{ color: mut, fontSize: 14, fontWeight: 600 }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}><span style={{ color: ink, fontSize: 38, fontWeight: 800, fontFamily: font(brief.fonts.heading) }}>{m.prefix || ''}{fmt(v)}{m.suffix || ''}</span>{m.delta && <span style={{ color: '#22c55e', fontSize: 15, fontWeight: 700, opacity: interpolate(frame, [t + 40, t + 54], [0, 1], clamp) }}>▲ {m.delta}</span>}</div>
            </div>) })}
        </div>
        <div style={{ margin: '0 28px', background: b.isDark ? '#22262d' : '#f8fafc', border: `1px solid ${line}`, borderRadius: 14, padding: 24, height: 340 }}>
          <div style={{ color: ink, fontSize: 16, fontWeight: 700, marginBottom: 18 }}>{(d.chartTitle as string) || 'Growth'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 240 }}>
            {bars.map((bar, i) => { const t = 96 + i * 9; const g = interpolate(frame, [t, t + 26], [0, 1], clamp); return <div key={i} style={{ flex: 1, height: `${bar * g}%`, background: `linear-gradient(180deg, ${pr}, ${withAlpha(pr, '88')})`, borderRadius: '8px 8px 0 0', minHeight: 4 }} /> })}
          </div>
        </div>
      </div>
      {frame >= 210 && <div style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', opacity: interpolate(frame, [210, 226], [0, 1], clamp), background: head, color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 20px', borderRadius: 11, display: 'flex', gap: 9 }}><span style={{ color: pr }}>✦</span>{(d.badge as string) || 'Every metric, updated in real time'}</div>}
    </AbsoluteFill>
  )
}

// EDITOR / CANVAS — a page composes itself block by block (title, text, image, CTA).
// Archetype for site/page/doc builders, no-code, design canvases.
export const EditorUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, unknown>
  const pr = b.primary, surf = b.isDark ? b.surface : '#ffffff', ink = b.isDark ? b.text : '#1d2430', mut = b.muted
  const line = b.isDark ? 'rgba(255,255,255,0.08)' : '#eceef2', rail = b.isDark ? 'rgba(255,255,255,0.04)' : '#f6f7f9'
  const docTitle = (d.docTitle as string) || 'Launch announcement'
  const blocks = (d.blocks as { type: string; text: string }[]) || [
    { type: 'heading', text: 'Introducing our fastest release yet' },
    { type: 'text', text: 'Ship in minutes, not weeks — with a workflow your whole team will actually use.' },
    { type: 'image', text: '' },
    { type: 'button', text: 'Get started free' },
  ]
  const palette = ['Heading', 'Text', 'Image', 'Button', 'Embed']
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 32%, ${withAlpha(pr, '1e')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef1f6'} 64%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}><div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div></div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1500, height: 700, background: surf, borderRadius: 18, boxShadow: '0 50px 120px rgba(20,28,46,0.34)', overflow: 'hidden', display: 'flex', border: `1px solid ${line}` }}>
        <div style={{ width: 220, background: rail, borderRight: `1px solid ${line}`, padding: 20 }}>
          <div style={{ color: mut, fontSize: 12, fontWeight: 800, letterSpacing: 1, marginBottom: 14 }}>BLOCKS</div>
          {palette.map((p, i) => <div key={i} style={{ background: surf, border: `1px solid ${line}`, borderRadius: 9, padding: '11px 13px', marginBottom: 9, color: ink, fontSize: 14, fontWeight: 600, opacity: interpolate(frame, [10 + i * 4, 22 + i * 4], [0, 1], clamp) }}>⋮⋮ {p}</div>)}
        </div>
        <div style={{ flex: 1, background: b.isDark ? '#101216' : '#fbfcfd', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40, overflow: 'hidden' }}>
          <div style={{ width: 820, background: surf, borderRadius: 14, boxShadow: '0 20px 50px rgba(20,28,46,0.14)', padding: '40px 48px', minHeight: 560 }}>
            <div style={{ color: mut, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 18, opacity: interpolate(frame, [40, 54], [0, 1], clamp) }}>{docTitle.toUpperCase()}</div>
            {blocks.map((bl, i) => { const t = 56 + i * 34; const s = spring({ frame: frame - t, fps, config: { damping: 15, stiffness: 120 } }); if (frame < t - 2) return null; const op = interpolate(s, [0, 1], [0, 1], clamp); const ty = interpolate(s, [0, 1], [16, 0], clamp); const common = { opacity: op, transform: `translateY(${ty}px)`, marginBottom: 22 }
              if (bl.type === 'heading') return <div key={i} style={{ ...common, color: ink, fontSize: 34, fontWeight: 800, fontFamily: font(brief.fonts.heading), lineHeight: 1.2 }}>{bl.text}</div>
              if (bl.type === 'text') return <div key={i} style={{ ...common, color: mut, fontSize: 19, lineHeight: 1.55 }}>{bl.text}</div>
              if (bl.type === 'image') return <div key={i} style={{ ...common, height: 200, borderRadius: 12, background: `linear-gradient(135deg, ${withAlpha(pr, '33')}, ${withAlpha(pr, '12')})`, border: `1px solid ${line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: withAlpha(ink, '88'), fontSize: 30 }}>🖼</div>
              return <div key={i} style={{ ...common, display: 'inline-block', background: pr, color: ctaText(pr), fontSize: 17, fontWeight: 800, padding: '14px 28px', borderRadius: 10 }}>{bl.text}</div> })}
          </div>
        </div>
      </div>
      {frame >= 224 && <div style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', opacity: interpolate(frame, [224, 240], [0, 1], clamp), background: b.isDark ? '#0e1014' : '#1d2430', color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 20px', borderRadius: 11, display: 'flex', gap: 9 }}><span style={{ color: pr }}>✦</span>{(d.badge as string) || 'Published in one click'}</div>}
    </AbsoluteFill>
  )
}

// CHECKOUT / PAYMENTS — cart → card fills → Pay → processing → success.
export const CheckoutUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, unknown>
  const pr = b.primary, surf = b.isDark ? b.surface : '#ffffff', ink = b.isDark ? b.text : '#1d2430', mut = b.muted
  const line = b.isDark ? 'rgba(255,255,255,0.09)' : '#ececf0'
  const items = (d.items as { name: string; price: string }[]) || [{ name: 'Pro plan — annual', price: '$240.00' }, { name: 'Onboarding', price: '$0.00' }]
  const total = (d.total as string) || '$240.00'
  const card = '4242 4242 4242 4242'
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const typedCard = card.slice(0, Math.max(0, Math.min(card.length, Math.floor((frame - 30) / 2.2))))
  const PAY = 110, paying = frame >= PAY && frame < PAY + 34, paid = frame >= PAY + 34
  const cy = frame < PAY ? 470 + interpolate(frame, [70, PAY], [0, 230], clamp) : 700
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1100px 860px at 50% 38%, ${withAlpha(pr, '22')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef1f6'} 60%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 46, width: '100%', textAlign: 'center' }}><div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div></div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 560, background: surf, borderRadius: 20, boxShadow: '0 50px 120px rgba(20,28,46,0.4)', overflow: 'hidden', border: `1px solid ${line}` }}>
        {!paid ? <div style={{ padding: 34 }}>
          <div style={{ color: ink, fontSize: 22, fontWeight: 800, fontFamily: font(brief.fonts.heading), marginBottom: 20 }}>Checkout</div>
          {items.map((it, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${line}`, color: ink, fontSize: 16, opacity: interpolate(frame, [10 + i * 6, 22 + i * 6], [0, 1], clamp) }}><span>{it.name}</span><span style={{ fontWeight: 600 }}>{it.price}</span></div>)}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 22px', color: ink, fontSize: 19, fontWeight: 800 }}><span>Total</span><span>{total}</span></div>
          <div style={{ color: mut, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Card number</div>
          <div style={{ border: `2px solid ${frame >= 30 && frame < PAY ? pr : line}`, borderRadius: 11, padding: '14px 16px', color: ink, fontSize: 18, letterSpacing: 1.5, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 16 }}>💳</span>{typedCard}{frame < PAY && <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: pr }}>|</span>}</div>
          <div style={{ marginTop: 18, background: pr, color: ctaText(pr), textAlign: 'center', padding: '16px 0', borderRadius: 12, fontWeight: 800, fontSize: 18, boxShadow: `0 12px 30px ${withAlpha(pr, '55')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>{paying ? <><span style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block', transform: `rotate(${frame * 16}deg)` }} />Processing…</> : `Pay ${total}`}</div>
        </div> : <div style={{ padding: '54px 34px', textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#22c55e', color: '#fff', fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', transform: `scale(${interpolate(frame, [PAY + 34, PAY + 50], [0, 1], clamp)})` }}>✓</div>
          <div style={{ color: ink, fontSize: 26, fontWeight: 800, fontFamily: font(brief.fonts.heading) }}>Payment successful</div>
          <div style={{ color: mut, fontSize: 16, marginTop: 8 }}>{total} · receipt sent · you're all set</div>
        </div>}
      </div>
      {!paid && frame < PAY + 4 && <Cursor x={interpolate(frame, [70, PAY], [360, 480], clamp)} y={cy} clickFrames={[PAY]} frame={frame} color={pr} />}
      {paid && <div style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', opacity: interpolate(frame, [PAY + 40, PAY + 56], [0, 1], clamp), background: b.isDark ? '#0e1014' : '#1d2430', color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 20px', borderRadius: 11, display: 'flex', gap: 9 }}><span style={{ color: pr }}>✦</span>{(d.badge as string) || 'Checkout in seconds'}</div>}
    </AbsoluteFill>
  )
}

// VOICE GEN / AUDIO — type a line → pick a voice → Generate → a waveform renders and
// plays. The archetype for TTS, voice agents, music, dubbing, podcast, audio tools.
export const VoiceGenUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, unknown>
  const pr = b.primary, surf = b.isDark ? b.surface : '#ffffff', ink = b.isDark ? b.text : '#0a0a0a', mut = b.muted
  const line = b.isDark ? 'rgba(255,255,255,0.09)' : '#ececec', rail = b.isDark ? 'rgba(255,255,255,0.03)' : '#fafafa'
  const acc = lum(pr) < 0.18 ? '#0a0a0a' : pr // pure-black brands stay black; the played waveform reads
  const text = (d.text as string) || 'In a world where every voice can be heard, your story finally sounds like you.'
  const voices = (d.voices as string[]) || ['Rachel', 'Adam', 'Bella', 'Antoni']
  const lang = (d.lang as string) || '70+ languages'
  const nav = ['Home', 'Voices', 'Studio', 'Dubbing', 'Music']
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const typed = text.slice(0, Math.max(0, Math.min(text.length, Math.floor((frame - 10) / 0.8))))
  const GEN = Math.max(10 + text.length * 0.8 + 4, 70)
  const generating = frame >= GEN && frame < GEN + 24
  const playing = frame >= GEN + 24
  const playStart = GEN + 24
  const prog = playing ? interpolate(frame, [playStart, playStart + 150], [0, 1], clamp) : 0
  const dur = 8, cur = (prog * dur)
  const mmss = (s: number) => `0:0${Math.min(9, Math.floor(s))}`
  const N = 56
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 32%, ${withAlpha(pr, b.isDark ? '20' : '14')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef0f3'} 64%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}><div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div></div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1560, height: 720, background: surf, borderRadius: 18, boxShadow: '0 50px 120px rgba(20,20,28,0.34)', overflow: 'hidden', display: 'flex', border: `1px solid ${line}` }}>
        {/* mini product sidebar (realism) */}
        <div style={{ width: 220, background: rail, borderRight: `1px solid ${line}`, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: ink, fontSize: 17, fontWeight: 800, fontFamily: font(brief.fonts.heading), marginBottom: 22 }}><span style={{ letterSpacing: -1 }}>‖</span>{brief.company}</div>
          {nav.map((n, i) => <div key={i} style={{ padding: '10px 12px', borderRadius: 9, marginBottom: 4, color: i === 1 ? ink : mut, background: i === 1 ? (b.isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0') : 'transparent', fontSize: 15, fontWeight: i === 1 ? 700 : 500, opacity: interpolate(frame, [8 + i * 4, 20 + i * 4], [0, 1], clamp) }}>{n}</div>)}
        </div>
        {/* composer */}
        <div style={{ flex: 1, padding: '40px 56px', position: 'relative' }}>
          <div style={{ color: ink, fontSize: 24, fontWeight: 800, fontFamily: font(brief.fonts.heading) }}>Text to Speech</div>
          {/* voice chips */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {voices.map((v, i) => <div key={i} style={{ opacity: interpolate(frame, [18 + i * 5, 30 + i * 5], [0, 1], clamp), display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 22, border: `1.5px solid ${i === 0 ? acc : line}`, background: i === 0 ? (b.isDark ? withAlpha(acc, '1a') : '#f5f5f5') : surf, color: i === 0 ? ink : mut, fontSize: 14, fontWeight: 600 }}><span style={{ width: 18, height: 18, borderRadius: '50%', background: ['#d97757', '#5b8def', '#cf6bdf', '#3aa675'][i % 4] }} />{v}</div>)}
            <div style={{ display: 'flex', alignItems: 'center', color: mut, fontSize: 13, marginLeft: 6 }}>+ 5,000 voices</div>
          </div>
          {/* text box */}
          <div style={{ marginTop: 18, border: `1.5px solid ${frame < GEN ? acc : line}`, borderRadius: 14, padding: '20px 22px', minHeight: 150, color: ink, fontSize: 21, lineHeight: 1.5 }}>{typed}{frame < GEN && <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: acc }}>|</span>}</div>
          {/* generate button */}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: acc, color: ctaText(acc), borderRadius: 12, padding: '14px 28px', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 9 }}>{generating ? <><span style={{ width: 16, height: 16, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', borderTopColor: ctaText(acc), display: 'inline-block', transform: `rotate(${frame * 16}deg)` }} />Generating…</> : '▷ Generate speech'}</div>
            <div style={{ color: mut, fontSize: 14 }}>{lang}</div>
          </div>
          {/* audio player with playing waveform */}
          {playing && <div style={{ marginTop: 26, opacity: interpolate(frame, [playStart, playStart + 12], [0, 1], clamp), background: b.isDark ? 'rgba(255,255,255,0.04)' : '#fafafa', border: `1px solid ${line}`, borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: acc, color: ctaText(acc), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>❚❚</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 48 }}>
              {Array.from({ length: N }, (_, i) => { const h = 18 + Math.abs(Math.sin(i * 0.5) * Math.cos(i * 0.23)) * 78; const played = i / N <= prog; return <div key={i} style={{ flex: 1, height: `${h * (played ? 1 : 0.75)}%`, background: played ? acc : (b.isDark ? 'rgba(255,255,255,0.18)' : '#d4d4d4'), borderRadius: 2 }} /> })}
            </div>
            <div style={{ color: mut, fontSize: 14, fontWeight: 600, flexShrink: 0, minWidth: 78, textAlign: 'right' }}>{mmss(cur)} / 0:0{dur}</div>
          </div>}
        </div>
      </div>
      {frame >= playStart + 30 && <div style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', opacity: interpolate(frame, [playStart + 30, playStart + 46], [0, 1], clamp), background: b.isDark ? '#0e1014' : '#0a0a0a', color: '#fff', fontSize: 15, fontWeight: 700, padding: '11px 20px', borderRadius: 11, display: 'flex', gap: 9 }}><span>🔊</span>{(d.badge as string) || 'Lifelike speech in 0.4s · 70+ languages'}</div>}
      {frame < GEN + 4 && <Cursor x={interpolate(frame, [GEN - 24, GEN], [700, 470], clamp)} y={interpolate(frame, [GEN - 24, GEN], [560, 690], clamp)} clickFrames={[GEN]} frame={frame} color={acc} />}
    </AbsoluteFill>
  )
}

// WALKTHROUGH / GUIDED TOUR — ask a question → a spotlight + tooltips walk you through
// the steps live on a real web app. Archetype for onboarding, adoption, in-app guidance,
// product tours, training (WalkMe / Pendo / Appcues / Userpilot / Guidely style).
export const WalkthroughUI: React.FC<{ brief: Brief }> = ({ brief }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = brief.brand
  const d = (brief.wow.productUI?.data || {}) as Record<string, unknown>
  const pr = b.primary, ink = '#1d2430', mut = '#8a909c', line = '#eceef2'
  const ask = (d.ask as string) || 'How do I create a new deal?'
  const steps = (d.steps as { tip: string; label: string }[]) || [
    { tip: 'Click here to start a new deal', label: '+ New deal' },
    { tip: 'Give your deal a name', label: 'Deal name' },
    { tip: 'Pick the pipeline stage', label: 'Stage' },
    { tip: 'Save it — you’re done!', label: 'Create deal' },
  ]
  // target rectangles inside the faux app (1560×740 window space)
  const rects = [{ x: 1316, y: 96, w: 196, h: 40 }, { x: 1004, y: 250, w: 480, h: 52 }, { x: 1004, y: 338, w: 480, h: 52 }, { x: 1004, y: 452, w: 200, h: 48 }]
  const win = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 }, from: 0.96, to: 1 })
  const winOp = interpolate(frame, [2, 14], [0, 1], clamp)
  const askOp = interpolate(frame, [16, 36], [0, 1], clamp)
  const START = 48, DUR = 58
  const n = steps.length
  const idx = Math.max(0, Math.min(n - 1, Math.floor((frame - START) / DUR)))
  const eio = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  const moveT = eio(interpolate(frame, [START + idx * DUR, START + idx * DUR + 16], [0, 1], clamp))
  const lerp = (a: number, c: number) => a + (c - a) * (idx === 0 ? 1 : moveT)
  const r0 = rects[Math.max(0, idx - 1)], r1 = rects[idx]
  const R = { x: lerp(r0.x, r1.x), y: lerp(r0.y, r1.y), w: lerp(r0.w, r1.w), h: lerp(r0.h, r1.h) }
  const done = frame >= START + n * DUR
  const dimA = done ? interpolate(frame, [START + n * DUR, START + n * DUR + 16], [0.6, 0], clamp) : 0.6
  const pulse = 1 + Math.sin(frame / 7) * 0.04
  // tooltip to the LEFT of the spotlight, pointing right
  const tipX = R.x - 320, tipY = R.y + R.h / 2 - 44
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 1300px 900px at 50% 32%, ${withAlpha(pr, '22')} 0%, ${b.isDark ? `rgb(${STAGE})` : '#eef0f3'} 64%)`, fontFamily: font(brief.fonts.body) }}>
      <div style={{ position: 'absolute', top: 44, width: '100%', textAlign: 'center' }}><div style={{ color: b.isDark ? LIGHT : ink, fontSize: 38, fontWeight: 700, fontFamily: font(brief.fonts.heading), opacity: interpolate(frame, [0, 20], [0, 1], clamp) }}>{brief.wow.headline}</div></div>
      <div style={{ position: 'absolute', left: '50%', top: '55%', transform: `translate(-50%,-50%) scale(${win})`, opacity: winOp, width: 1560, height: 740, background: '#ffffff', borderRadius: 16, boxShadow: '0 50px 120px rgba(20,28,46,0.4)', overflow: 'hidden', border: `1px solid ${line}` }}>
        {/* faux web app (any app Guidely runs on) */}
        <div style={{ height: 56, background: '#0f1117', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 22 }}>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>Acme CRM</div>
          {['Deals', 'Contacts', 'Reports'].map((t, i) => <span key={i} style={{ color: i === 0 ? '#fff' : '#9aa1ad', fontSize: 14, fontWeight: i === 0 ? 700 : 500 }}>{t}</span>)}
        </div>
        <div style={{ position: 'absolute', inset: '56px 0 0 0', background: '#f6f7f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 30px' }}>
            <div style={{ color: ink, fontSize: 26, fontWeight: 800, fontFamily: font(brief.fonts.heading) }}>Deals</div>
            <div style={{ background: pr, color: ctaText(pr), fontWeight: 800, fontSize: 14, padding: '10px 18px', borderRadius: 9 }}>+ New deal</div>
          </div>
          {/* faux table */}
          <div style={{ margin: '0 30px', background: '#fff', border: `1px solid ${line}`, borderRadius: 12, width: 900 }}>
            {['Acme Corp · $12,000', 'Globex · $8,500', 'Initech · $21,000', 'Umbrella · $5,400'].map((t, i) => <div key={i} style={{ padding: '16px 20px', borderBottom: i < 3 ? `1px solid ${line}` : 'none', color: ink, fontSize: 15, display: 'flex', justifyContent: 'space-between' }}><span>{t.split(' · ')[0]}</span><span style={{ color: mut }}>{t.split(' · ')[1]}</span></div>)}
          </div>
          {/* "New deal" form panel */}
          <div style={{ position: 'absolute', top: 90, right: 30, width: 500, background: '#fff', border: `1px solid ${line}`, borderRadius: 14, boxShadow: '0 18px 40px rgba(20,28,46,0.12)', padding: 24 }}>
            <div style={{ color: ink, fontSize: 18, fontWeight: 800, marginBottom: 18 }}>New deal</div>
            {['Deal name', 'Stage', 'Value'].map((f, i) => <div key={i} style={{ marginBottom: 16 }}><div style={{ color: mut, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{f}</div><div style={{ border: `1.5px solid ${line}`, borderRadius: 9, padding: '13px 14px', color: mut, fontSize: 14 }}>{['Acme Corp expansion', 'Qualified', '$18,000'][i]}</div></div>)}
            <div style={{ background: pr, color: ctaText(pr), textAlign: 'center', fontWeight: 800, fontSize: 15, padding: '13px 0', borderRadius: 10, width: 200 }}>Create deal</div>
          </div>
        </div>
        {/* spotlight dim with a hole over the current target */}
        {!done && <div style={{ position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, borderRadius: 10, boxShadow: `0 0 0 9999px rgba(10,8,16,${dimA})`, border: `2.5px solid ${pr}`, outline: `${pr} solid 0`, transition: 'none' }} />}
        {/* Ask Guidely pill (top) */}
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', opacity: askOp, background: '#1c1424', color: '#fff', border: `1px solid ${withAlpha(pr, '55')}`, borderRadius: 22, padding: '9px 18px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 9, zIndex: 20 }}><span style={{ color: pr }}>✦ {brief.company}</span><span style={{ color: '#cfd2da' }}>{ask}</span></div>
        {/* tooltip card */}
        {!done && <div style={{ position: 'absolute', left: tipX, top: tipY, width: 290, background: '#1c1424', color: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 16px 40px rgba(0,0,0,0.4)', border: `1px solid ${withAlpha(pr, '40')}`, zIndex: 21, transform: `scale(${pulse})` }}>
          <div style={{ color: pr, fontSize: 12, fontWeight: 800, marginBottom: 6 }}>STEP {idx + 1} OF {n}</div>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{steps[idx].tip}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 5 }}>{steps.map((_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === idx ? pr : 'rgba(255,255,255,0.25)' }} />)}</div>
            <div style={{ background: pr, color: ctaText(pr), fontSize: 13, fontWeight: 800, padding: '6px 14px', borderRadius: 8 }}>{idx === n - 1 ? 'Finish' : 'Next →'}</div>
          </div>
        </div>}
        {/* animated cursor to the target */}
        {!done && <Cursor x={R.x + R.w - 30} y={R.y + R.h / 2} clickFrames={rects.map((_, i) => START + i * DUR + 10)} frame={frame} color={pr} />}
      </div>
      {done && <div style={{ position: 'absolute', bottom: 64, left: '50%', transform: `translateX(-50%) scale(${interpolate(frame, [START + n * DUR, START + n * DUR + 16], [0.9, 1], clamp)})`, opacity: interpolate(frame, [START + n * DUR, START + n * DUR + 16], [0, 1], clamp), background: '#1c1424', color: '#fff', fontSize: 16, fontWeight: 700, padding: '13px 22px', borderRadius: 11, display: 'flex', gap: 10, border: `1px solid ${withAlpha(pr, '55')}` }}><span style={{ color: pr }}>✓</span>{(d.badge as string) || 'Guide saved — share it with your team'}</div>}
    </AbsoluteFill>
  )
}

const PRODUCT_UI: Record<string, React.FC<{ brief: Brief }>> = { scheduling: SchedulingUI, pipeline: PipelineUI, formbuilder: FormBuilderUI, designstudio: DesignStudioUI, doctransform: DocTransformUI, chat: ChatUI, dashboard: DashboardUI, editor: EditorUI, checkout: CheckoutUI, voicegen: VoiceGenUI, walkthrough: WalkthroughUI }
export const ProductUIScene: React.FC<{ brief: Brief }> = ({ brief }) => { const k = brief.wow.productUI?.kind || ''; const V = PRODUCT_UI[k]; return V ? <V brief={brief} /> : <WowScene brief={brief} /> }

// ── Layout dispatchers ───────────────────────────────────────────────────────
const REVEAL_V: Record<string, React.FC<{ brief: Brief }>> = { browser: RevealScene, split: RevealSplit, fullbleed: RevealFullBleed }
const WOW_V: Record<string, React.FC<{ brief: Brief }>> = { checklist: WowScene, beforeafter: WowBeforeAfter, gallery: WowGallery }
const OUT_V: Record<string, React.FC<{ brief: Brief }>> = { stat: OutcomeScene, metrics: OutcomeMetrics }

const PAIN_V: Record<string, React.FC<{ brief: Brief }>> = { cards: PainCards, tabs: PainTabs, stack: PainStack }
export const Pain: React.FC<{ brief: Brief }> = ({ brief }) => { const V = PAIN_V[brief.pain.layout || 'cards'] || PainCards; return <V brief={brief} /> }
export const Reveal: React.FC<{ brief: Brief }> = ({ brief }) => { const V = REVEAL_V[brief.reveal.layout || 'browser'] || RevealScene; return <V brief={brief} /> }
export const Wow: React.FC<{ brief: Brief }> = ({ brief }) => { if (brief.wow.productUI) return <ProductUIScene brief={brief} />; if (brief.wow.video) return <WowRealVideo brief={brief} />; const V = WOW_V[brief.wow.layout || 'checklist'] || WowScene; return <V brief={brief} /> }
export const Outcome: React.FC<{ brief: Brief }> = ({ brief }) => { const V = OUT_V[brief.outcome.layout || 'stat'] || OutcomeScene; return <V brief={brief} /> }

export const SCENE_COMPONENTS = { Scene1_Pain: PainScene, Scene2_Reveal: RevealScene, Scene3_Wow: WowScene, Scene4_Outcome: OutcomeScene }
