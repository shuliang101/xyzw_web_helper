/**
 * 后端 Node.js WebSocket 客户端
 * 基于 ws 包实现，参考前端 wsAgent.js 逻辑
 */
import WebSocket from 'ws'
import https from 'https'
import { encode, parse, getEnc, bon, g_utils } from './bonProtocol.js'

const commandDefaults = {
  role_getroleinfo: {
    clientVersion: '2.21.2-fa918e1997301834-wx',
    inviteUid: 0,
    platform: 'hortor',
    platformExt: 'mix',
    scene: '',
  },
  system_getdatabundlever: {
    isAudit: false,
  },
  system_buygold: {
    buyNum: 1,
  },
  system_claimhangupreward: {},
  system_mysharecallback: {
    isSkipShareCard: true,
    type: 2,
  },
  system_custom: {
    key: '',
    value: 0,
  },
  friend_batch: {
    friendId: 0,
  },
  hero_recruit: {
    byClub: false,
    recruitNumber: 1,
    recruitType: 3,
  },
  item_openbox: {
    itemId: 2001,
    number: 10,
  },
  mail_claimallattachment: {
    category: 0,
  },
  bottlehelper_claim: {},
  bottlehelper_start: {
    bottleType: -1,
  },
  bottlehelper_stop: {
    bottleType: -1,
  },
  arena_startarea: {},
  arena_getareatarget: {
    refresh: false,
  },
  genie_sweep: {
    genieId: 1,
  },
  genie_buysweep: {},
  discount_claimreward: {
    discountId: 1,
  },
  collection_claimfreereward: {},
  card_claimreward: {
    cardId: 1,
  },
  collection_goodslist: {},
  legion_signin: {},
  presetteam_saveteam: {
    teamId: 1,
  },
  presetteam_getinfo: {},
  artifact_lottery: {
    lotteryNumber: 1,
    newFree: true,
    type: 1,
  },
  fight_startlevel: {},
}

function buildCommandBody(cmd, params = {}) {
  const defaults = commandDefaults[cmd] || {}
  return bon.encode({ ...defaults, ...params })
}

/**
 * 读取 bin 文件并调用游戏登录接口，返回 token JSON 字符串
 * 对应前端 src/utils/token.ts 的 transformToken
 */
export async function transformBinToToken(binFilePath) {
  const fs = await import('fs')
  const buffer = fs.readFileSync(binFilePath)

  return new Promise((resolve, reject) => {
    const url = new URL('https://xxz-xyzw.hortorgames.com/login/authuser?_seq=1')
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length,
        'Referer': 'https://xxz-xyzw.hortorgames.com/',
      },
    }
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks)
          const msg = g_utils.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
          const parsed = msg.getData()
          const currentTime = Date.now()
          const sessId = currentTime * 100 + Math.floor(Math.random() * 100)
          const connId = currentTime + Math.floor(Math.random() * 10)
          resolve(JSON.stringify({ ...parsed, sessId, connId, isRestore: 0 }))
        } catch (e) {
          reject(new Error(`解析 authuser 响应失败: ${e.message}`))
        }
      })
    })
    req.on('error', reject)
    req.write(buffer)
    req.end()
  })
}

export class GameWebSocketClient {
  constructor(url, options = {}) {
    this.url = url
    this.enc = getEnc('auto')
    this.ws = null
    this.connected = false
    this.connecting = false
    this.ack = 0
    this.seq = 1
    this.sendQueue = []
    this._heartbeatTimer = null
    this._queueTimer = null
    this._reconnectTimer = null
    this.reconnectAttempts = 0
    this.waitingPromises = new Map()

    const {
      heartbeatInterval = 2000,
      queueInterval = 50,
      autoReconnect = false,
      maxReconnectAttempts = 3,
      reconnectDelay = 3000,
    } = options

    this.heartbeatInterval = heartbeatInterval
    this.queueInterval = queueInterval
    this.autoReconnect = autoReconnect
    this.maxReconnectAttempts = maxReconnectAttempts
    this.reconnectDelay = reconnectDelay

    this.onOpen = () => {}
    this.onClose = () => {}
    this.onError = () => {}
    this.onMessage = () => {}
  }

  connect() {
    if (this.connecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      try {
        this.connecting = true
        this.ws = new WebSocket(this.url)

        const timeout = setTimeout(() => {
          this.connecting = false
          reject(new Error('连接超时'))
        }, 15000)

        this.ws.on('open', () => {
          clearTimeout(timeout)
          this.connected = true
          this.connecting = false
          this.reconnectAttempts = 0
          this._startHeartbeat()
          this._startQueueLoop()
          this.onOpen()
          resolve()
        })

        this.ws.on('message', (data) => {
          try {
            let packet
            if (typeof data === 'string') {
              packet = JSON.parse(data)
            } else {
              const buf = data instanceof Buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data
              packet = parse(buf, getEnc('auto'))
            }
            this._handleMessage(packet)
            this.onMessage(packet)
          } catch (e) {
            // 忽略解析错误
          }
        })

        this.ws.on('close', () => {
          this.connected = false
          this.connecting = false
          this._stopHeartbeat()
          this._stopQueueLoop()
          this._rejectAllPromises('连接已断开')
          this.onClose()
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            this._reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay)
          }
        })

        this.ws.on('error', (err) => {
          clearTimeout(timeout)
          this.connecting = false
          this.onError(err)
          reject(err)
        })
      } catch (err) {
        this.connecting = false
        reject(err)
      }
    })
  }

  _handleMessage(packet) {
    if (!packet) return
    const rawPacket = packet?._raw || packet
    const ack = rawPacket?.ack

    // 更新服务端 ack
    if (ack !== undefined && ack !== 0) {
      this.ack = ack
    }

    // 与前端保持一致：优先使用服务端最新 seq 作为下次请求 ack
    const incomingSeq = rawPacket?.seq
    if (incomingSeq !== undefined && incomingSeq >= 0) {
      this.ack = incomingSeq
    }

    // 用 resp 字段匹配（服务器响应里 resp = 请求的 seq）
    const respSeq = rawPacket?.resp
    if (respSeq !== undefined) {
      for (const [key, entry] of this.waitingPromises) {
        if (key.endsWith(`:${respSeq}`)) {
          clearTimeout(entry.timeoutId)
          this.waitingPromises.delete(key)
          if (rawPacket?.code && rawPacket.code !== 0) {
            entry.reject(new Error(`[${rawPacket.code}] ${rawPacket.error || rawPacket.hint || '命令失败'}`))
          } else {
            // 优先用 rawData（ProtoMsg 自动 decode body），否则用 body
            entry.resolve(packet.rawData ?? packet.body)
          }
          return
        }
      }
    }
  }

  _rejectAllPromises(reason) {
    for (const [, { reject, timeoutId }] of this.waitingPromises) {
      clearTimeout(timeoutId)
      reject(new Error(reason))
    }
    this.waitingPromises.clear()
  }

  _startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        const hb = { cmd: '_sys/ack', ack: this.ack, seq: 0, time: Date.now(), body: {} }
        try {
          const buf = encode(hb, getEnc('x'))
          this.ws.send(buf)
        } catch (e) { /* 忽略心跳错误 */ }
      }
    }, this.heartbeatInterval)
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null }
  }

  _startQueueLoop() {
    this._queueTimer = setInterval(() => {
      if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) return
      while (this.sendQueue.length > 0) {
        const item = this.sendQueue.shift()
        try { this.ws.send(item) } catch (e) { /* 忽略发送错误 */ }
      }
    }, this.queueInterval)
  }

  _stopQueueLoop() {
    if (this._queueTimer) { clearInterval(this._queueTimer); this._queueTimer = null }
  }

  /**
   * 发送命令并等待响应
   * @param {string} cmd 命令名
   * @param {object} params 参数
   * @param {number} timeout 超时毫秒
   */
  sendWithPromise(cmd, params = {}, timeout = 8000) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('WebSocket 未连接'))
      }

      const seq = this.seq++
      const raw = {
        cmd,
        ack: this.ack,
        seq,
        time: Date.now(),
        body: buildCommandBody(cmd, params),
      }

      try {
        const buf = encode(raw, getEnc('x'))
        const respKey = `${cmd.toLowerCase()}:${seq}`
        const timeoutId = setTimeout(() => {
          this.waitingPromises.delete(respKey)
          reject(new Error(`命令超时: ${cmd}`))
        }, timeout)

        this.waitingPromises.set(respKey, { resolve, reject, timeoutId })
        this.sendQueue.push(buf)
      } catch (err) {
        reject(err)
      }
    })
  }

  disconnect() {
    this.autoReconnect = false
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null }
    this._stopHeartbeat()
    this._stopQueueLoop()
    this._rejectAllPromises('主动断开连接')
    if (this.ws) {
      try { this.ws.close() } catch (e) { /* 忽略 */ }
      this.ws = null
    }
    this.connected = false
  }
}

/**
 * 构建游戏 WebSocket URL
 * token 字段已经是 JSON 字符串（由前端 transformToken 处理后存储）
 * 格式: wss://xxz-xyzw.hortorgames.com/agent?p=<encoded_token>&e=x&lang=chinese
 */
export function buildGameWsUrl(tokenStr, customWsUrl = null) {
  if (customWsUrl) return customWsUrl
  const encoded = encodeURIComponent(tokenStr)
  return `wss://xxz-xyzw.hortorgames.com/agent?p=${encoded}&e=x&lang=chinese`
}
