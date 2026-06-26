// Procedural per-SaaS music generator (no external API, no samples).
// Builds a soundtrack that tracks the pain → reveal → wow → outcome arc. The MOOD is
// chosen from the product's brief (category + brand), so different products get genuinely
// different instrumentation/feel — not the same track every time. Node raw-PCM synth →
// ffmpeg master → public/real/<slug>/music.mp3.
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')
const SR = 44100

function seedFrom(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) }
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

// profile drives the ARRANGEMENT (drums, lead instrument, busyness) — this is what makes
// moods sound different from each other, not just transposed.
type Profile = 'pop' | 'electronic' | 'corporate' | 'cinematic' | 'lofi' | 'anthem'
type Mood = { root: number; bpm: number; prog: number[][]; bright: number; scale: number[]; profile: Profile }
const MOODS: Record<string, Mood> = {
  UPLIFT:     { root: 57, bpm: 112, prog: [[0,4,7,11],[5,9,12,16],[7,11,14,17],[9,12,16,19]], bright: 0.62, scale: [0,2,4,7,9,12,14,16], profile: 'pop' },
  ELECTRONIC: { root: 52, bpm: 124, prog: [[0,3,7,10],[-2,2,5,9],[3,7,10,14],[5,8,12,15]], bright: 0.82, scale: [0,3,5,7,10,12,15,17], profile: 'electronic' },
  CORPORATE:  { root: 60, bpm: 114, prog: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]], bright: 0.7, scale: [0,2,4,7,9,11,12,16], profile: 'corporate' },
  CINEMATIC:  { root: 53, bpm: 90,  prog: [[0,3,7,10],[-4,0,3,7],[5,8,12,15],[-2,3,7,10]], bright: 0.5, scale: [0,2,3,5,7,8,10,12], profile: 'cinematic' },
  LOFI:       { root: 55, bpm: 82,  prog: [[0,3,7,10],[5,9,12,16],[-2,2,5,9],[3,7,10,14]], bright: 0.42, scale: [0,2,3,5,7,9,10,12], profile: 'lofi' },
  ANTHEM:     { root: 57, bpm: 126, prog: [[0,4,7,11],[9,12,16,19],[5,9,12,16],[7,11,14,19]], bright: 0.88, scale: [0,2,4,7,9,11,14,16], profile: 'anthem' },
}

// Choose a mood from the BRIEF: product category (the recreated wow UI kind) + brand mood,
// with a per-product seed tiebreak so even same-category products vary.
function pickMood(slug: string): { mood: Mood; name: string } {
  let group = ['UPLIFT', 'CORPORATE', 'ELECTRONIC']
  try {
    const bp = path.join(BASE, 'out', `${slug}_brief.json`)
    if (existsSync(bp)) {
      const b = JSON.parse(readFileSync(bp, 'utf-8'))
      const kind = b?.wow?.productUI?.kind || ''
      const isDark = !!b?.brand?.isDark
      const blob = [b?.company, b?.pain?.headline, b?.reveal?.tagline, b?.wow?.headline].join(' ').toUpperCase()
      if (/voicegen|designstudio/.test(kind)) group = ['CINEMATIC', 'ANTHEM']
      else if (/pipeline|dashboard|checkout/.test(kind)) group = ['CORPORATE', 'ELECTRONIC']
      else if (/editor|formbuilder/.test(kind)) group = ['ELECTRONIC', 'ANTHEM']
      else if (/doctransform|walkthrough|scheduling|chat/.test(kind)) group = isDark ? ['LOFI', 'CINEMATIC'] : ['UPLIFT', 'LOFI']
      else if (/MUSIC|AUDIO|VIDEO|VOICE|CREATIV|DESIGN|ART|STUDIO/.test(blob)) group = ['CINEMATIC', 'ANTHEM']
      else if (/CRM|SALES|FINANCE|BILLING|ANALYTIC|DATA|REVENUE|GROWTH/.test(blob)) group = ['CORPORATE', 'ELECTRONIC']
      else if (/DEV|API|CODE|DEPLOY|INFRA|ENGINEER/.test(blob)) group = ['ELECTRONIC', 'ANTHEM']
      else group = isDark ? ['CINEMATIC', 'LOFI', 'ELECTRONIC'] : ['UPLIFT', 'CORPORATE', 'LOFI']
    }
  } catch { /* default group */ }
  const name = group[seedFrom(slug + 'mood') % group.length]
  return { mood: MOODS[name] || MOODS.UPLIFT, name }
}

export function generateMusic(slug: string, durationSec = 38): string {
  const { mood: M0 } = pickMood(slug)
  const rng = mulberry(seedFrom(slug))
  // per-seed variation: transpose key, jitter tempo, rotate progression, swing, lead timbre
  const rootShift = [0, 2, -3, 5, -5, 3, -1][Math.floor(rng() * 7) % 7]
  const bpmVar = Math.round((rng() * 2 - 1) * 6)
  const rot = Math.floor(rng() * M0.prog.length)
  const mood: Mood = { ...M0, root: M0.root + rootShift, bpm: Math.max(76, Math.min(132, M0.bpm + bpmVar)), prog: M0.prog.map((_, i) => M0.prog[(i + rot) % M0.prog.length]) }
  const P = mood.profile
  const swing = (P === 'lofi' ? 0.16 : P === 'pop' && rng() > 0.5 ? 0.08 : 0)
  const leadDetune = 1 + (rng() * 2 - 1) * 0.004
  const dropFrac = P === 'cinematic' || P === 'lofi' ? 0.34 : 0.36 + rng() * 0.08

  // melodic HOOK — a short seeded phrase (stepwise over the scale)
  const mrng = mulberry(seedFrom(slug + 'mel'))
  const motif: { deg: number; dur: number }[] = (() => {
    const rhy = [[1, 1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 0.5, 0.5], [0.75, 0.25, 1, 1, 1], [2, 1, 1], [1.5, 0.5, 1, 1]][Math.floor(mrng() * 6) % 6]
    let si = 2 + Math.floor(mrng() * 3)
    const out: { deg: number; dur: number }[] = []
    for (const d of rhy) { const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(mrng() * 7) % 7]; si = Math.max(0, Math.min(mood.scale.length - 1, si + step)); out.push({ deg: mood.scale[si], dur: d }) }
    return out
  })()

  const n = Math.floor(SR * durationSec)
  const L = new Float32Array(n), R = new Float32Array(n)
  const beat = 60 / mood.bpm, bar = beat * 4, sw = swing * beat

  // energy arc — flatter/chiller for lofi & cinematic, dynamic drop for the rest
  const energyAt = (t: number) => {
    const f = t / durationSec
    if (P === 'lofi') { if (f < 0.13) return 0.32; if (f < 0.4) return 0.5; if (f < 0.8) return 0.66; return 0.55 }
    if (P === 'cinematic') { if (f < 0.13) return 0.24; if (f < 0.4) return 0.42 + (f - 0.13) * 0.7; if (f < 0.8) return 0.82; return 0.66 }
    if (f < 0.13) return 0.18; if (f < 0.40) return 0.45 + (f - 0.13) * 0.7; if (f < 0.80) return 0.97; return 0.72
  }
  const swell = (i: number) => { const t = i / SR; return Math.max(0, Math.min(Math.min(1, t / 1.4), Math.min(1, (durationSec - t) / 2.5))) }
  const noise = mulberry(seedFrom(slug + 'n'))
  const add = (start: number, k: number, v: number, pan = 0) => { const idx = start + k; if (idx < 0 || idx >= n) return; const g = swell(idx); L[idx] += v * g * (1 - Math.max(0, pan)); R[idx] += v * g * (1 + Math.min(0, pan)) }

  // ── voices ──
  const kick = (t0: number, soft = false) => { const s = Math.floor(t0 * SR), d = Math.floor((soft ? 0.34 : 0.3) * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const pitch = (soft ? 90 : 120) * Math.exp(-tt * (soft ? 22 : 28)) + (soft ? 40 : 45); const e = Math.exp(-tt * (soft ? 7 : 9)); add(s, k, Math.sin(2 * Math.PI * pitch * tt) * e * (soft ? 0.7 : 0.95)) } }
  const clap = (t0: number, gain = 0.32) => { const s = Math.floor(t0 * SR), d = Math.floor(0.18 * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.exp(-tt * 22) * (1 + 0.6 * Math.sin(tt * 900)); add(s, k, (noise() * 2 - 1) * e * gain) } }
  const hat = (t0: number, open: boolean, gain = 0.16) => { const s = Math.floor(t0 * SR), d = Math.floor((open ? 0.12 : 0.035) * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.exp(-tt * (open ? 28 : 80)); add(s, k, (noise() * 2 - 1) * e * gain) } }
  const bass = (f: number, t0: number, dur: number, gain: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.min(1, tt / 0.005) * Math.exp(-tt * 4.5); const saw = 2 * ((f * tt) % 1) - 1; const sub = Math.sin(2 * Math.PI * f * tt); add(s, k, (0.5 * saw + sub) * e * gain * 0.5) } }
  const arp = (f: number, t0: number, gain: number, pan: number) => { const s = Math.floor(t0 * SR), d = Math.floor(0.16 * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.exp(-tt * 14); const sq = Math.sign(Math.sin(2 * Math.PI * f * tt)); const saw = 2 * ((f * tt) % 1) - 1; add(s, k, (0.5 * saw + 0.3 * sq) * e * gain * (0.18 + mood.bright * 0.1), pan) } }
  const lead = (f: number, t0: number, dur: number, gain: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.min(1, tt / 0.01) * Math.exp(-tt * 2.0); const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * tt); add(s, k, (Math.sin(2 * Math.PI * f * tt * vib * leadDetune) + 0.3 * Math.sin(2 * Math.PI * 2 * f * tt)) * e * gain * 0.2) } }
  // warm piano/rhodes-ish voice for cinematic & lofi (sine stack, soft attack, long tail)
  const piano = (f: number, t0: number, dur: number, gain: number, pan = 0) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.min(1, tt / 0.012) * Math.exp(-tt * 1.5); add(s, k, (Math.sin(2 * Math.PI * f * tt) + 0.45 * Math.sin(2 * Math.PI * 2 * f * tt) + 0.18 * Math.sin(2 * Math.PI * 3 * f * tt)) * e * gain * 0.16, pan) } }
  const pad = (chord: number[], t0: number, dur: number, gain: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.min(1, tt / 0.5) * Math.min(1, (dur - tt) / 0.5); let x = 0; for (const m of chord) { const f = midiToFreq(mood.root + m); x += Math.sin(2 * Math.PI * f * tt) + 0.5 * (2 * ((f * 1.005 * tt) % 1) - 1) } x /= chord.length * 2.5; const pump = P === 'lofi' || P === 'cinematic' ? 1 : 1 - 0.35 * Math.max(0, Math.sin(2 * Math.PI * (tt % beat) / beat)); add(s, k, x * e * gain * 0.5 * pump) } }
  const riser = (t0: number, dur: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const f = tt / dur; const e = f * f; const hp = (noise() * 2 - 1) * (0.4 + 0.6 * f); const tone = Math.sin(2 * Math.PI * (200 + 1400 * f) * tt); add(s, k, (0.5 * hp + 0.5 * tone) * e * 0.26) } }

  // ── arrange ──
  const nBars = Math.ceil(durationSec / bar)
  const dropT = durationSec * dropFrac
  const edm = P === 'pop' || P === 'electronic' || P === 'corporate' || P === 'anthem'
  let riserPlaced = false
  for (let b = 0; b < nBars; b++) {
    const t0 = b * bar; if (t0 >= durationSec) break
    const e = energyAt(t0)
    const chord = mood.prog[b % mood.prog.length]
    const rootF = midiToFreq(mood.root + chord[0] - 12)

    pad(chord, t0, bar, (P === 'cinematic' ? 0.6 : 0.4) + e * 0.7)
    // cinematic/lofi sustain a soft piano comp of the chord through the bar
    if ((P === 'cinematic' || P === 'lofi') && e >= 0.4) chord.forEach((m, i) => piano(midiToFreq(mood.root + m), t0 + i * sw, bar, 0.5 + e * 0.4, ((i % 2) - 0.5) * 0.4))

    if (edm && !riserPlaced && t0 + bar > dropT) { riser(dropT - bar * 0.9, bar * 0.9); for (let r = 0; r < 6; r++) clap(dropT - beat * (1 - r / 6) - 0.02, 0.26); riserPlaced = true }

    if (e >= 0.3) {
      if (P === 'cinematic') { kick(t0, true); kick(t0 + beat * 2, true); bass(rootF, t0, beat * 1.6, 0.6 + e * 0.4); bass(rootF, t0 + beat * 2, beat * 1.6, 0.5 + e * 0.4) }
      else if (P === 'lofi') { kick(t0, true); kick(t0 + beat * 2.5, true); clap(t0 + beat * 2, 0.22); bass(rootF, t0, beat * 0.9, 0.6); bass(midiToFreq(mood.root + chord[1] - 12), t0 + beat * 2, beat * 0.9, 0.55) }
      else { for (let bt = 0; bt < 4; bt++) { kick(t0 + bt * beat); bass(rootF, t0 + bt * beat, beat * 0.55, 0.6 + e * 0.5) } if (P === 'anthem') for (let bt = 0; bt < 4; bt++) bass(rootF / 2, t0 + bt * beat, beat * 0.5, 0.4 + e * 0.4) }
    }
    if (e >= 0.5) {
      if (P === 'lofi') { for (let h = 0; h < 8; h++) hat(t0 + h * (beat / 2) + (h % 2 ? sw : 0), h % 4 === 3, 0.1) }
      else if (P === 'cinematic') { hat(t0 + beat, true, 0.08); hat(t0 + beat * 3, true, 0.08) }
      else { clap(t0 + beat); clap(t0 + beat * 3); for (let h = 0; h < 8; h++) hat(t0 + h * (beat / 2) + beat / 2, false) }
    }
    // melodic payoff at the wow
    if (e >= (P === 'lofi' || P === 'cinematic' ? 0.62 : 0.85)) {
      if (P === 'cinematic' || P === 'lofi') {
        let mt = t0; for (const nt of motif) { if (mt >= t0 + bar) break; piano(midiToFreq(mood.root + 12 + nt.deg), mt, beat * nt.dur, 1.1); mt += beat * nt.dur }
      } else {
        const tones = chord.map(m => midiToFreq(mood.root + m + 12))
        for (let s16 = 0; s16 < 16; s16++) { const f = tones[s16 % tones.length] * (s16 % 8 >= 4 ? 2 : 1); arp(f, t0 + s16 * (beat / 4) + (s16 % 2 ? sw : 0), 1, ((s16 % 2) - 0.5) * 0.5) }
        let mt = t0; for (const nt of motif) { if (mt >= t0 + bar) break; lead(midiToFreq(mood.root + 12 + nt.deg), mt, beat * nt.dur * 0.96, P === 'anthem' ? 1.1 : 0.9); mt += beat * nt.dur }
      }
    } else if (e >= 0.55 && edm) {
      const tones = chord.map(m => midiToFreq(mood.root + m + 12))
      for (let s8 = 0; s8 < 8; s8++) arp(tones[s8 % tones.length], t0 + s8 * (beat / 2), 0.7, ((s8 % 2) - 0.5) * 0.4)
    }
  }
  if (edm) { kick(durationSec - 0.05); clap(durationSec - 0.05) }

  // ── write WAV ──
  const wavPath = path.join(os.tmpdir(), `music_${slug}_${seedFrom(slug)}.wav`)
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  let off = 44
  for (let i = 0; i < n; i++) { const sl = Math.tanh(L[i] * 1.05), sr = Math.tanh(R[i] * 1.05); buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sl * 30000))), off); off += 2; buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sr * 30000))), off); off += 2 }
  writeFileSync(wavPath, buf)

  const outDir = path.join(BASE, 'public', 'real', slug); mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'music.mp3')
  const filt = ['highpass=f=32', 'equalizer=f=120:t=q:w=1.0:g=2', 'treble=g=1.5:f=9000', 'lowpass=f=15500', 'extrastereo=m=1.35', 'aecho=0.7:0.7:60|130:0.22|0.1', 'acompressor=threshold=-17dB:ratio=3.5:attack=10:release=200', 'alimiter=limit=0.95', 'loudnorm=I=-14:TP=-1.5:LRA=10'].join(',')
  execSync(`ffmpeg -y -i "${wavPath}" -af "${filt}" -codec:a libmp3lame -b:a 256k "${outPath}"`, { stdio: 'ignore' })
  return outPath
}

if (process.argv[1] && process.argv[1].includes('music')) {
  const slug = process.argv[2]; const dur = process.argv[3] ? parseFloat(process.argv[3]) : 38
  if (!slug) { console.error('Usage: npx tsx agent/music.ts <slug> [durationSec]'); process.exit(1) }
  const { name } = pickMood(slug)
  const out = generateMusic(slug, dur)
  console.log(`✓ Custom soundtrack for "${slug}" (mood: ${name}, ${dur}s) → ${path.relative(BASE, out)}`)
}
