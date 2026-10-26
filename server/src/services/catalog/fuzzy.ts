// Owned by workstream F. Typo-tolerant matching for catalog search (no dependencies).
import { normalizeKey } from '../../lib/validation.js'

/** Words that say nothing about which exam is meant; dropped from fuzzy queries unless nothing else remains. */
const STOPWORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'in', 'on', 'to', 'exam', 'exams', 'cert', 'certs', 'certificate', 'certification', 'certifications', 'certified', 'test'])

/** A candidate's searchable words: provider, code, title and aliases split into lower-case tokens (plus compact forms). */
export type FuzzyVocabulary = string[]

/** Overall score (mean of per-token best scores) a candidate needs to be included. */
export const FUZZY_MIN_SCORE = 0.75
/** At least one query token must match this well, so a candidate is never included on weak matches alone. */
export const FUZZY_MIN_ANCHOR = 0.85
/** Score for a query token that is a prefix of a candidate word ("admin" in "administrator"). */
const PREFIX_SCORE = 0.92

/** Splits text into lower-case word tokens. '+' stays part of a word ("security+"); other punctuation separates. */
export function tokenize(text: string): string[] {
  return normalizeKey(text).split(/[^\p{L}\p{N}+]+/u).filter(Boolean)
}

/** Query tokens worth matching: stopwords and single characters are dropped (unless that would leave nothing). */
export function queryTokens(query: string): string[] {
  const tokens = tokenize(query)
  const meaningful = tokens.filter((token) => token.length > 1 && !STOPWORDS.has(token))
  return meaningful.length ? meaningful : tokens
}

export function buildVocabulary(candidate: { provider: string; code: string; title: string; aliases: string[] }): FuzzyVocabulary {
  const words = new Set<string>()
  for (const text of [candidate.provider, candidate.code, candidate.title, ...candidate.aliases]) {
    for (const token of tokenize(text)) words.add(token)
  }
  // Compact forms of the code and short code-like aliases ("az104", "sy0701", "ccarf"), so "ccar f" or "az 104" style typos still land.
  for (const text of [candidate.code, ...candidate.aliases.filter((alias) => alias.length <= 12)]) {
    const compactForm = normalizeKey(text).replace(/[^\p{L}\p{N}+]/gu, '')
    if (compactForm) words.add(compactForm)
  }
  return [...words]
}

/**
 * Optimal string alignment distance (Damerau-Levenshtein with adjacent transpositions),
 * stopping early once the distance must exceed `max`. Returns max + 1 in that case.
 */
export function damerauLevenshtein(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previousPrevious: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, (previousPrevious[j - 2] ?? 0) + 1)
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    if (rowMin > max) return max + 1
    previousPrevious = previous
    previous = current
  }
  return previous[b.length] ?? max + 1
}

/** Edits tolerated for a token of this length: none up to 3 characters, 1 up to 5, 2 up to 8, then 3. */
function allowedEdits(length: number) {
  if (length <= 3) return 0
  if (length <= 5) return 1
  if (length <= 8) return 2
  return 3
}

/** Similarity of one query token to one candidate word, 0..1. */
export function tokenSimilarity(token: string, word: string): number {
  if (token === word) return 1
  if (token.length >= 2 && word.startsWith(token)) return token.length >= 3 ? PREFIX_SCORE : 0.8
  const edits = allowedEdits(Math.min(token.length, word.length))
  if (!edits) return 0
  const distance = damerauLevenshtein(token, word, edits)
  if (distance > edits) return 0
  return 1 - distance / Math.max(token.length, word.length)
}

/**
 * Fuzzy score of a candidate for the query tokens (0..1), or null when it does not clear the thresholds.
 * Score = mean over query tokens of the best similarity to any candidate word.
 */
export function fuzzyScore(tokens: string[], vocabulary: FuzzyVocabulary): number | null {
  if (!tokens.length || !vocabulary.length) return null
  let total = 0
  let anchor = 0
  for (const token of tokens) {
    let best = 0
    for (const word of vocabulary) {
      const similarity = tokenSimilarity(token, word)
      if (similarity > best) best = similarity
      if (best === 1) break
    }
    total += best
    if (best > anchor) anchor = best
  }
  const score = total / tokens.length
  return score >= FUZZY_MIN_SCORE && anchor >= FUZZY_MIN_ANCHOR ? score : null
}
