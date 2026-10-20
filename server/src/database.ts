import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from './generated/prisma/client.js'
import { config } from './config.js'

const adapter = new PrismaLibSql({ url: config.databaseUrl })

export const prisma = new PrismaClient({ adapter })