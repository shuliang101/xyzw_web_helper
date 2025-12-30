import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import routes from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { config } from './config/index.js'
import { ensureDir } from './utils/fileSystem.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

ensureDir(config.uploadDir)
app.use('/files/bin', express.static(config.uploadDir))

app.use('/api', routes)

const distPath = path.resolve(__dirname, '../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    const requestPath = req.path || req.originalUrl || ''
    if (requestPath.startsWith('/api') || requestPath.startsWith('/files')) {
      return next()
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  console.warn('[server] dist directory not found. Frontend assets will not be served.')
}

app.use(errorHandler)

const start = () => {
  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`)
  })
}

start()
