import { basename, extname } from 'node:path'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

export const MAX_FILE_CHARS = 40_000
export const MAX_TOTAL_CHARS = 60_000

export interface UploadedIntakeFile { buffer: Buffer; mimetype: string; originalname: string }
export interface ExtractedFile { name: string; mimeType: string; size: number; chars: number; text: string; truncated: boolean }

/** Thrown for files the user must fix (unsupported type, unreadable content). The message is safe to show. */
export class IntakeFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntakeFileError'
  }
}

type FileKind = 'pdf' | 'docx' | 'text'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown'])
const TEXT_MIMES = new Set(['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream', ''])

function safeName(originalname: string) {
  return basename(originalname).replace(/\p{Cc}/gu, '').slice(0, 200) || 'file'
}

function detectKind(file: UploadedIntakeFile): FileKind {
  const extension = extname(file.originalname).toLocaleLowerCase()
  const head = file.buffer.subarray(0, 5)
  if (extension === '.pdf') {
    if (head.toString('ascii') !== '%PDF-') throw new IntakeFileError(`${safeName(file.originalname)} is not a valid PDF file.`)
    return 'pdf'
  }
  if (extension === '.docx') {
    if (head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 0x03 || head[3] !== 0x04) throw new IntakeFileError(`${safeName(file.originalname)} is not a valid Word (.docx) file.`)
    return 'docx'
  }
  if (TEXT_EXTENSIONS.has(extension) && TEXT_MIMES.has(file.mimetype)) {
    if (file.buffer.includes(0)) throw new IntakeFileError(`${safeName(file.originalname)} does not look like a text file.`)
    return 'text'
  }
  throw new IntakeFileError(`${safeName(file.originalname)} is not supported. Upload PDF, DOCX, TXT or Markdown files.`)
}

export function isSupportedIntakeFileName(originalname: string) {
  return ['.pdf', '.docx', ...TEXT_EXTENSIONS].includes(extname(originalname).toLocaleLowerCase())
}

export function collapseWhitespace(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v \u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function rawText(kind: FileKind, buffer: Buffer): Promise<string> {
  if (kind === 'pdf') {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    // pdf-parse appends "-- N of M --" page markers; drop them.
    try { return (await parser.getText()).text.replace(/^-- \d+ of \d+ --$/gm, '') }
    finally { await parser.destroy().catch(() => undefined) }
  }
  if (kind === 'docx') return (await mammoth.extractRawText({ buffer })).value
  return buffer.toString('utf8').replace(/^\uFEFF/, '')
}

/** Extracts plain text from one uploaded PDF, DOCX, TXT or Markdown file, capped at MAX_FILE_CHARS. */
export async function extractText(file: UploadedIntakeFile): Promise<ExtractedFile> {
  const kind = detectKind(file)
  const name = safeName(file.originalname)
  let text: string
  try { text = collapseWhitespace(await rawText(kind, file.buffer)) }
  catch (error) {
    console.warn(`Could not extract text from intake upload (${kind}):`, error)
    throw new IntakeFileError(`${name} could not be read. Check that it is not encrypted or damaged.`)
  }
  const truncated = text.length > MAX_FILE_CHARS
  if (truncated) text = `${text.slice(0, MAX_FILE_CHARS)}\n[Truncated: the rest of this file was omitted.]`
  const mimeType = kind === 'pdf' ? 'application/pdf' : kind === 'docx' ? DOCX_MIME : extname(name).toLocaleLowerCase() === '.txt' ? 'text/plain' : 'text/markdown'
  return { name, mimeType, size: file.buffer.length, chars: text.length, text, truncated }
}

/** Joins the extracted files into one document for the prompt, capped at MAX_TOTAL_CHARS overall. */
export function combineExtractedText(files: ExtractedFile[]): string {
  let remaining = MAX_TOTAL_CHARS - 2 * files.length
  const parts: string[] = []
  for (const file of files) {
    const header = `--- Document: ${file.name} ---\n`
    if (remaining <= header.length) {
      parts.push(`[Truncated: ${file.name} was omitted because the total document limit was reached.]`)
      continue
    }
    let body = file.text
    const room = remaining - header.length
    const note = '\n[Truncated: the total document limit was reached.]'
    if (body.length > room) body = `${body.slice(0, Math.max(0, room - note.length))}${note}`
    parts.push(header + body)
    remaining -= header.length + body.length
  }
  return parts.join('\n\n')
}
