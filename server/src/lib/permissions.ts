import type { Request } from 'express'
import type { Certification, User } from '../generated/prisma/client.js'
import { config } from '../config.js'
import { prisma } from '../database.js'

export function currentIdentity(request: Request) {
  if (!request.authIdentity) throw new Error('Authentication middleware did not attach a user.')
  return request.authIdentity
}

export async function currentUser(request: Request): Promise<User> {
  const identity = currentIdentity(request)
  return prisma.user.upsert({
    where: { tenantId_objectId: { tenantId: identity.tenantId, objectId: identity.objectId } },
    create: { tenantId: identity.tenantId, objectId: identity.objectId, displayName: identity.displayName },
    update: { displayName: identity.displayName },
  })
}

export function isAdmin(request: Request) {
  const identity = currentIdentity(request)
  return identity.roles.includes('Upskill.Admin') || config.adminObjectIds.has(identity.objectId)
}

export function canManageCertification(request: Request, user: User, certification: Certification) {
  return isAdmin(request) || certification.createdById === user.id
}

export function canManageResource(request: Request, user: User, createdById: string) {
  return isAdmin(request) || createdById === user.id
}