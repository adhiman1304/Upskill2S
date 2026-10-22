import assert from 'node:assert/strict'
import test from 'node:test'
import { certificationSchema, validateResourceContent } from '../src/lib/validation.js'

const certification = { provider: 'Microsoft', code: 'AZ-900', title: 'Azure Fundamentals' }

test('certification descriptions preserve supported rich-text formatting', () => {
  const description = '<h2>Overview</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>First</li></ul><ol><li>Second</li></ol><blockquote>Quote</blockquote><p><a href="https://example.com">Source</a></p>'
  assert.equal(certificationSchema.parse({ ...certification, description }).description, description)
})

test('certification descriptions remove scripts, event handlers, and unsafe links', () => {
  const description = '<p onclick="alert(1)">Safe<script>alert(1)</script><img src=x onerror="alert(1)"></p><a href="javascript:alert(1)">Bad</a><a href="http://example.com">HTTP</a><a href="//example.com">Relative</a>'
  assert.equal(
    certificationSchema.parse({ ...certification, description }).description,
    '<p>Safe</p><a>Bad</a><a>HTTP</a><a>Relative</a>',
  )
})

test('legacy plain-text, multiline, and empty descriptions remain supported', () => {
  const description = 'Learn A & B.\nUse values < 5 and > 1.'
  assert.equal(certificationSchema.parse({ ...certification, description }).description, description)
  assert.equal(certificationSchema.parse(certification).description, '')
  assert.equal(certificationSchema.parse({ ...certification, description: '' }).description, '')
})

test('description validation accepts the exact limit and rejects oversized or non-string input', () => {
  assert.equal(certificationSchema.safeParse({ ...certification, description: 'a'.repeat(30000) }).success, true)
  assert.equal(certificationSchema.safeParse({ ...certification, description: 'a'.repeat(30001) }).success, false)
  assert.equal(certificationSchema.safeParse({ ...certification, description: 42 }).success, false)
})

test('study notes retain supported formatting with the shared sanitizer', () => {
  const html = '<p><strong>Study notes</strong> <a href="https://example.com">Source</a></p>'
  assert.equal(validateResourceContent('RICH_TEXT', { html }, false), JSON.stringify({ html }))
})
