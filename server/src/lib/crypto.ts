import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { config } from '../config.js'

// AES-256-GCM envelope for secrets at rest (user API keys).
// Format: v1:<iv b64>:<auth tag b64>:<ciphertext b64>
const VERSION = 'v1'
const IV_BYTES = 12
const key = Buffer.from(hkdfSync('sha256', config.keyEncryptionSecret, 'upskill-key-encryption', 'upskill:secret:v1', 32))

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, ciphertext, ...rest] = payload.split(':')
  if (version !== VERSION || !iv || !tag || ciphertext === undefined || rest.length) throw new Error('Unsupported encrypted secret format.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'), { authTagLength: 16 })
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')
}
