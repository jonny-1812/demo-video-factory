// Procedural per-SaaS music generator (no external API, no samples).
// Builds an ENERGETIC demo soundtrack with a beat + build + drop + resolve that
// tracks the pain -> reveal -> wow -> outcome arc. Node raw-PCM synth → ffmpeg
// master → public/real/<slug>/music.mp3. Unique per product (mood + seed).
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const BASE = path.resolve(path.dirname(__filename), '..')
const SR = 44100

function seedFrom(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) }
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

// mood presets — energetic by design. root midi, bpm, 4-chord progression (semitone offsets),
// chord shape sizes, brightness. All build/drop the same way; mood sets key/tempo/feel.
// scale = semitone set the melodic HOOK is drawn from (relative to root).
type Mood = { root: number; bpm: number; prog: number[][]; bright: number; scale: number[] }
const MOODS: Record<string, Mood> = {
  // warm but uplifting & driving — lifestyle / design / most demos (major pentatonic-ish)
  UPLIFT:    { root: 57, bpm: 110, prog: [[0,4,7,11],[5,9,12,16],[7,11,14,17],[9,12,16,19]], bright: 0.62, scale: [0,2,4,7,9,12,14,16] },
  // techy, propulsive — SaaS / dev / productivity (dorian-ish, cooler)
  ELECTRONIC:{ root: 52, bpm: 122, prog: [[0,3,7,10],[ -2,2,5,9],[3,7,10,14],[5,8,12,15]], bright: 0.8, scale: [0,3,5,7,10,12,15,17] },
  // clean, motivational — sales / finance / marketing (bright major)
  CORPORATE: { root: 60, bpm: 112, prog: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]], bright: 0.7, scale: [0,2,4,7,9,11,12,16] },
}
function pickMood(slug: string): { mood: Mood; name: string } {
  let name = 'UPLIFT'
  try {
    const sp = path.join(BASE, 'out', `${slug}_script.json`)
    if (existsSync(sp)) {
      const s = JSON.parse(readFileSync(sp, 'utf-8'))
      const blob = ((s.scenes || []).map((x: { type?: string }) => x.type || '').join(' ') + ' ' + (s.productSummary || '')).toUpperCase()
      if (/CRM|SALES|MARKET|ECOMMERCE|SHOP|FINANCE|BILLING|GROWTH/.test(blob)) name = 'CORPORATE'
      else if (/DEV|API|CODE|ANALYTIC|DASHBOARD|DATA|PRODUCTIV|PROJECT/.test(blob)) name = 'ELECTRONIC'
      else name = 'UPLIFT'
    }
  } catch { /* default */ }
  return { mood: MOODS[name] || MOODS.UPLIFT, name }
}

export function generateMusic(slug: string, durationSec = 38): string {
  const { mood: M0, name } = pickMood(slug)
  const rng = mulberry(seedFrom(slug))
  // ── per-seed variation: transpose key, jitter tempo, rotate progression so no
  // two products share a soundtrack (the old engine reused one prog per mood).
  const rootShift = [0, 2, -3, 5, -5, 3][Math.floor(rng() * 6) % 6]
  const bpmVar = Math.round((rng() * 2 - 1) * 7)
  const rot = Math.floor(rng() * M0.prog.length)
  const mood: Mood = { ...M0, root: M0.root + rootShift, bpm: Math.max(98, Math.min(130, M0.bpm + bpmVar)), prog: M0.prog.map((_, i) => M0.prog[(i + rot) % M0.prog.length]) }

  // ── melodic HOOK: a short, seeded, memorable phrase (stepwise over the scale).
  // Reused across the wow/drop so the track has an identity instead of generic arps.
  const mrng = mulberry(seedFrom(slug + 'mel'))
  const motif: { deg: number; dur: number }[] = (() => {
    const rhy = [[1, 1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 0.5, 0.5], [0.75, 0.25, 1, 1, 1]][Math.floor(mrng() * 4) % 4]
    let si = 2 + Math.floor(mrng() * 3)
    const out: { deg: number; dur: number }[] = []
    for (const d of rhy) {
      const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(mrng() * 7) % 7]
      si = Math.max(0, Math.min(mood.scale.length - 1, si + step))
      out.push({ deg: mood.scale[si], dur: d })
    }
    return out
  })()
  const n = Math.floor(SR * durationSec)
  const L = new Float32Array(n), R = new Float32Array(n)
  const beat = 60 / mood.bpm, bar = beat * 4, six = beat / 4

  // energy arc keyed to the demo structure (pain→reveal→wow→outcome)
  const energyAt = (t: number) => {
    const f = t / durationSec
    if (f < 0.13) return 0.18                          // pain: sparse tension
    if (f < 0.40) return 0.45 + (f - 0.13) * 0.7       // reveal: building
    if (f < 0.80) return 0.95                          // wow: full drop
    return 0.7                                          // outcome: resolve
  }
  const swell = (i: number) => { const t = i / SR; return Math.max(0, Math.min(Math.min(1, t / 1.2), Math.min(1, (durationSec - t) / 2.5))) }
  const noise = mulberry(seedFrom(slug + 'n'))

  const add = (start: number, k: number, v: number, pan = 0) => {
    const idx = start + k; if (idx < 0 || idx >= n) return
    const g = swell(idx)
    L[idx] += v * g * (1 - Math.max(0, pan)); R[idx] += v * g * (1 + Math.min(0, pan))
  }

  // ── voices ────────────────────────────────────────────────────────────────
  const kick = (t0: number) => { const s = Math.floor(t0 * SR), d = Math.floor(0.3 * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const pitch = 120 * Math.exp(-tt * 28) + 45; const e = Math.exp(-tt * 9); add(s, k, Math.sin(2 * Math.PI * pitch * tt) * e * 0.95) } }
  const clap = (t0: number) => { const s = Math.floor(t0 * SR), d = Math.floor(0.18 * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.exp(-tt * 22) * (1 + 0.6 * Math.sin(tt * 900)); add(s, k, (noise() * 2 - 1) * e * 0.32) } }
  const hat = (t0: number, open: boolean) => { const s = Math.floor(t0 * SR), d = Math.floor((open ? 0.12 : 0.035) * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.exp(-tt * (open ? 28 : 80)); add(s, k, (noise() * 2 - 1) * e * 0.16) } }
  const bass = (f: number, t0: number, dur: number, gain: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.min(1, tt / 0.005) * Math.exp(-tt * 4.5); const saw = 2 * ((f * tt) % 1) - 1; const sub = Math.sin(2 * Math.PI * f * tt); add(s, k, (0.5 * saw + sub) * e * gain * 0.5) } }
  const arp = (f: number, t0: number, gain: number, pan: number) => { const s = Math.floor(t0 * SR), d = Math.floor(0.16 * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.exp(-tt * 14); const sq = Math.sign(Math.sin(2 * Math.PI * f * tt)); const saw = 2 * ((f * tt) % 1) - 1; add(s, k, (0.5 * saw + 0.3 * sq) * e * gain * (0.18 + mood.bright * 0.1), pan) } }
  const lead = (f: number, t0: number, dur: number, gain: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.min(1, tt / 0.01) * Math.exp(-tt * 2.0); const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * tt); add(s, k, (Math.sin(2 * Math.PI * f * tt * vib) + 0.3 * Math.sin(2 * Math.PI * 2 * f * tt)) * e * gain * 0.2) } }
  const pad = (chord: number[], t0: number, dur: number, gain: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const e = Math.min(1, tt / 0.4) * Math.min(1, (dur - tt) / 0.4); let x = 0; for (const m of chord) { const f = midiToFreq(mood.root + m); x += Math.sin(2 * Math.PI * f * tt) + 0.5 * (2 * ((f * 1.005 * tt) % 1) - 1) } x /= chord.length * 2.5; const pump = 1 - 0.35 * Math.max(0, Math.sin(2 * Math.PI * (tt % beat) / beat)) // sidechain-ish pump on the beat
      add(s, k, x * e * gain * 0.5 * pump) } }
  const riser = (t0: number, dur: number) => { const s = Math.floor(t0 * SR), d = Math.floor(dur * SR); for (let k = 0; k < d; k++) { const tt = k / SR; const f = tt / dur; const e = f * f; const hp = (noise() * 2 - 1) * (0.4 + 0.6 * f); const tone = Math.sin(2 * Math.PI * (200 + 1400 * f) * tt); add(s, k, (0.5 * hp + 0.5 * tone) * e * 0.28) } }

  // ── arrange ────────────────────────────────────────────────────────────────
  const nBars = Math.ceil(durationSec / bar)
  const dropT = durationSec * 0.40
  let riserPlaced = false
  for (let b = 0; b < nBars; b++) {
    const t0 = b * bar
    if (t0 >= durationSec) break
    const e = energyAt(t0)
    const chord = mood.prog[b % mood.prog.length]
    const rootF = midiToFreq(mood.root + chord[0] - 12)

    // pad always (body), gain rides energy
    pad(chord, t0, bar, 0.4 + e * 0.7)

    // riser into the drop
    if (!riserPlaced && t0 + bar > dropT) {
      riser(dropT - bar * 0.9, bar * 0.9)
      // accelerating snare/clap fill in the last beat before the drop
      for (let r = 0; r < 6; r++) clap(dropT - beat * (1 - r / 6) - 0.02)
      riserPlaced = true
    }

    if (e >= 0.3) {
      // 4-on-the-floor kick + bass
      for (let bt = 0; bt < 4; bt++) { kick(t0 + bt * beat); bass(rootF, t0 + bt * beat, beat * 0.55, 0.6 + e * 0.5) }
    }
    if (e >= 0.5) {
      // claps on 2 & 4, offbeat hats
      clap(t0 + beat); clap(t0 + beat * 3)
      for (let h = 0; h < 8; h++) hat(t0 + h * (beat / 2) + beat / 2, false)
    }
    if (e >= 0.85) {
      // WOW: driving 16th arp of chord tones + lead hook + open hats
      const tones = chord.map(m => midiToFreq(mood.root + m + 12))
      for (let s16 = 0; s16 < 16; s16++) { const f = tones[s16 % tones.length] * (s16 % 8 >= 4 ? 2 : 1); arp(f, t0 + s16 * six, 1, ((s16 % 2) - 0.5) * 0.5) }
      // the melodic HOOK across the bar (the line you remember)
      let mt = t0
      for (const nt of motif) {
        if (mt >= t0 + bar) break
        lead(midiToFreq(mood.root + 12 + nt.deg), mt, beat * nt.dur * 0.96, 0.9)
        mt += beat * nt.dur
      }
    } else if (e >= 0.55) {
      // reveal: lighter arp (8ths)
      const tones = chord.map(m => midiToFreq(mood.root + m + 12))
      for (let s8 = 0; s8 < 8; s8++) arp(tones[s8 % tones.length], t0 + s8 * (beat / 2), 0.7, ((s8 % 2) - 0.5) * 0.4)
    }
  }
  // final hit + tail
  kick(durationSec - 0.05); clap(durationSec - 0.05)

  // ── write WAV ───────────────────────────────────────────────────────────────
  const wavPath = `/tmp/music_${slug}_${seedFrom(slug)}.wav`
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  let off = 44
  for (let i = 0; i < n; i++) { const sl = Math.tanh(L[i] * 1.05), sr = Math.tanh(R[i] * 1.05); buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sl * 30000))), off); off += 2; buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sr * 30000))), off); off += 2 }
  writeFileSync(wavPath, buf)

  // ── master: punchy, a touch of space, loud ─────────────────────────────────
  const outDir = path.join(BASE, 'public', 'real', slug); mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'music.mp3')
  // warmer low end, gentler top (was harsh +3dB@8k), lowpass to kill fizz, wider stereo.
  const filt = ['highpass=f=32', 'equalizer=f=120:t=q:w=1.0:g=2', 'treble=g=1.5:f=9000', 'lowpass=f=15500', 'extrastereo=m=1.35', 'aecho=0.7:0.7:60|130:0.22|0.1', 'acompressor=threshold=-17dB:ratio=3.5:attack=10:release=200', 'alimiter=limit=0.95', 'loudnorm=I=-14:TP=-1.5:LRA=10'].join(',')
  execSync(`ffmpeg -y -i "${wavPath}" -af "${filt}" -codec:a libmp3lame -b:a 256k "${outPath}" 2>/dev/null`, { stdio: 'ignore' })
  return outPath
}

if (process.argv[1] && process.argv[1].includes('music')) {
  const slug = process.argv[2]; const dur = process.argv[3] ? parseFloat(process.argv[3]) : 38
  if (!slug) { console.error('Usage: npx tsx agent/music.ts <slug> [durationSec]'); process.exit(1) }
  const { name } = pickMood(slug)
  const out = generateMusic(slug, dur)
  console.log(`✓ Custom soundtrack for "${slug}" (mood: ${name}, ${dur}s) → ${path.relative(BASE, out)}`)
}
