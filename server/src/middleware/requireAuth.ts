import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { RequestHandler } from 'express'
import { apiAudience, config, localAuthBypass } from '../config.js'

export interface AuthIdentity {
  tenantId: string
  objectId: string
  displayName: string
  roles: string[]
}

declare module 'express-serve-static-core' {
  interface Request { authIdentity?: AuthIdentity }
}

const jwks = config.tenantId
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`))
  : null

export const requireAuth: RequestHandler = async (request, response, next) => {
  if (localAuthBypass) {
    request.authIdentity = { tenantId: 'local-development', objectId: 'local-developer', displayName: 'Local Developer', roles: [] }
    next()
    return
  }

  const authorization = request.header('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token || !jwks) {
    response.status(401).json({ error: 'A valid company access token is required.' })
    return
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
      audience: apiAudience,
    })
    if (payload.tid !== config.tenantId || typeof payload.oid !== 'string') {
      response.status(401).json({ error: 'The access token is not from the configured company tenant.' })
      return
    }
    request.authIdentity = {
      tenantId: payload.tid,
      objectId: payload.oid,
      displayName: typeof payload.name === 'string' ? payload.name : 'Company user',
      roles: Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === 'string') : [],
    }
    next()
  } catch {
    response.status(401).json({ error: 'The company access token is invalid or expired.' })
  }
}