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
import { scheduler } from './services/taskScheduler.js'
import { clubCarScheduler } from './services/clubCarScheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

const proxyConfigs = [
  {
    prefix: '/api/weixin-long',
    target: 'https://long.open.weixin.qq.com',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN',
      'Accept': '*/*',
      'Referer': 'https://open.weixin.qq.com/'
    }
  },
  {
    prefix: '/api/weixin',
    target: 'https://open.weixin.qq.com',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://open.weixin.qq.com/'
    }
  },
  {
    prefix: '/api/hortor',
    target: 'https://comb-platform.hortorgames.com',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36',
      'Accept': '*/*',
      'Host': 'comb-platform.hortorgames.com',
      'Connection': 'keep-alive',
      'Content-Type': 'text/plain; charset=utf-8',
      'Origin': 'https://open.weixin.qq.com',
      'Referer': 'https://open.weixin.qq.com/'
    }
  }
].sort((a, b) => b.prefix.length - a.prefix.length)

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return chunks.length ? Buffer.concat(chunks) : undefined
}

app.use(async (req, res, next) => {
  const proxy = proxyConfigs.find(item => req.path.startsWith(item.prefix))
  if (!proxy) {
    return next()
  }

  try {
    const targetUrl = new URL(proxy.target)
    targetUrl.pathname = req.path.replace(proxy.prefix, '') || '/'
    targetUrl.search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) {
        continue
      }
      if (Array.isArray(value)) {
        headers.set(key, value.join(', '))
      } else {
        headers.set(key, value)
      }
    }

    for (const [key, value] of Object.entries(proxy.headers)) {
      headers.set(key, value)
    }

    headers.delete('content-length')

    const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase())
    const body = hasBody ? await readRawBody(req) : undefined

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'follow'
    })

    res.status(response.status)
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') {
        return
      }
      res.setHeader(key, value)
    })

    const arrayBuffer = await response.arrayBuffer()
    res.send(Buffer.from(arrayBuffer))
  } catch (error) {
    next(error)
  }
})

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
    scheduler.start()
    clubCarScheduler.start()
  })
}

start()
