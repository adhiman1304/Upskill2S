// Compatibility barrel: existing imports of './lib/api' keep working.
// New code should import from './lib/api/client' or a feature module under './lib/api/'.
export * from './api/client'
export * from './api/legacy'
