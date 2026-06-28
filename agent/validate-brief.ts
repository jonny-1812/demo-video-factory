// Brief validator/normalizer — the load-bearing guard against silent-wrong-output.
//
// Background: every productUI template in src/templates/scenes.tsx reads
// `(brief.wow.productUI?.data || {})` and then `(d.x) || <hardcoded default>`.
// So a missing, MISNESTED, or unknown-kind brief renders plausible-but-WRONG
// content (the keply "$48,200" dashboard) instead of failing. assemble-templated.ts
// used to JSON.parse the brief raw with a compile-only `as Brief` cast and no
// runtime check. This module is called at that one choke point (before render),
// so a bad brief becomes a loud, actionable build failure — never a wrong video.
//
// Calibration (do NOT regress): MANY good briefs legitimately omit optional fields
// (badge, chartTitle, delta, sourceType, lang, …) and rely on template defaults.
// We validate ONLY the per-kind SIGNAL fields — the one/few fields whose absence
// means the data is empty/placeholder — and only for the kind actually chosen.
import { existsSync } from 'fs'
import path from 'path'

// Keep in sync with PRODUCT_UI in src/templates/scenes.tsx.
export const VALID_KINDS = [
  'scheduling', 'pipeline', 'formbuilder', 'designstudio', 'doctransform',
  'chat', 'dashboard', 'editor', 'checkout', 'voicegen', 'walkthrough',
] as const

// Per-kind SIGNAL fields (nested under productUI.data). Absence => the template
// would otherwise render generic placeholder data for a DIFFERENT product.
const SIGNAL_FIELDS: Record<string, string[]> = {
  scheduling: ['host', 'event'],
  pipeline: ['cols', 'rows'],
  formbuilder: ['prompt'],
  designstudio: ['prompt', 'image'],
  doctransform: ['source', 'notebookTitle', 'sections'],
  chat: ['question', 'answer'],
  dashboard: ['metrics'],
  editor: ['blocks'],
  checkout: ['items', 'total'],
  voicegen: ['text'],
  walkthrough: ['ask', 'steps'],
}

const isAbsent = (v: unknown): boolean =>
  v === undefined || v === null ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'string' && v.trim() === '')

export interface ValidateOpts {
  strict?: boolean      // default true: errors halt the build. false: errors become warnings.
  slug?: string         // used to verify designstudio image belongs to this product
  baseDir?: string      // repo root, to resolve image paths under public/
}

export interface ValidateResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brief: any
  warnings: string[]
  errors: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeAndValidateBrief(brief: any, opts: ValidateOpts = {}): ValidateResult {
  const warnings: string[] = []
  const errors: string[] = []
  const slug = opts.slug
  const baseDir = opts.baseDir

  const pu = brief?.wow?.productUI

  // No productUI at all is legitimate — the Wow scene falls back to a layout/video.
  if (!pu || typeof pu !== 'object') {
    return { brief, warnings, errors }
  }

  // (A) NORMALIZE the keply flat-vs-nested mistake. Safe: only fires when there is
  // no `data` key yet, so an already-nested brief is never touched.
  if (!pu.data) {
    const { kind: _kind, data: _data, ...rest } = pu
    const promoted = Object.keys(rest)
    if (promoted.length) {
      pu.data = rest
      for (const k of promoted) delete pu[k]
      warnings.push(
        `wow.productUI: lifted ${promoted.length} flat field(s) [${promoted.join(', ')}] into productUI.data ` +
        `(they belong under "data", not directly on productUI). Fix the brief to nest them yourself.`
      )
    }
  }

  // (B) HARD-VALIDATE kind. An unknown/missing kind otherwise silently degrades to
  // the generic WowScene (scenes.tsx ProductUIScene dispatcher).
  const kind = pu.kind
  if (isAbsent(kind)) {
    errors.push(`wow.productUI.kind is missing. It must be one of: ${VALID_KINDS.join(', ')}.`)
  } else if (!VALID_KINDS.includes(kind)) {
    errors.push(`wow.productUI.kind "${kind}" is not a recognized archetype. Use one of: ${VALID_KINDS.join(', ')}.`)
  } else {
    // (C) PER-KIND SIGNAL-FIELD presence (only for the chosen kind).
    const data = (pu.data && typeof pu.data === 'object') ? pu.data : {}
    const required = SIGNAL_FIELDS[kind] || []
    for (const f of required) {
      if (isAbsent(data[f])) {
        errors.push(
          `wow.productUI.data.${f} is missing/empty for kind "${kind}". ` +
          `The ${kind} template will otherwise render generic placeholder data (not ${brief.company || 'this product'}'s).`
        )
      }
    }

    // designstudio image must be a real asset for THIS product — never another
    // product's screenshot. (Default was a hardcoded 'real/dexo/img_5.png' leak.)
    if (kind === 'designstudio' && !isAbsent(data.image)) {
      const imagePath = String(data.image)
      if (slug && !imagePath.startsWith(`real/${slug}/`)) {
        errors.push(
          `wow.productUI.data.image "${imagePath}" does not belong to this product. ` +
          `It must be a scanned asset under "real/${slug}/" — a foreign path renders another company's screenshot.`
        )
      }
      if (baseDir) {
        const onDisk = path.join(baseDir, 'public', imagePath)
        if (!existsSync(onDisk)) {
          errors.push(`wow.productUI.data.image "${imagePath}" not found at public/${imagePath}.`)
        }
      }
    }
  }

  // In lenient mode, demote errors to warnings so the operator can still build.
  if (opts.strict === false && errors.length) {
    warnings.push(...errors.map((e) => `[lenient] ${e}`))
    errors.length = 0
  }

  return { brief, warnings, errors }
}
