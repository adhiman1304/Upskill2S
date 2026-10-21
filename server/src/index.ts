import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { Prisma } from './generated/prisma/client.js'
import { config } from './config.js'
import { prisma } from './database.js'
import { apiRouter } from './routes/api.js'
import { registerHandlers } from './services/jobs/handlers.js'
import { recoverInterruptedJobs, startJobWorker, stopJobWorker } from './services/jobs/queue.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: config.clientOrigin, allowedHeaders: ['Authorization', 'Content-Type'] }))
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/api', apiRouter)
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    response.status(500).json({ error: 'The database could not complete this request.' })
    return
  }
  if (error instanceof Error && error.name === 'MulterError') {
    response.status(413).json({ error: 'The PDF exceeds the upload limit.' })
    return
  }
  console.error(error)
  response.status(500).json({ error: 'An unexpected server error occurred.' })
})

registerHandlers()
await recoverInterruptedJobs()
startJobWorker()

const server = app.listen(config.port, () => console.log(`Upskill API listening on http://localhost:${config.port}`))
let shuttingDown = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    const workerStopped = stopJobWorker()
    server.close(async () => { await workerStopped; await prisma.$disconnect(); process.exit(0) })
  })
}