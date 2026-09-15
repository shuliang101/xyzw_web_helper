<template>
  <div class="game-player">
    <button class="back-btn" @click="goBack">← 返回</button>

    <div class="iframe-wrapper">
      <iframe
        v-if="gameSrc"
        :src="gameSrc"
        class="game-iframe"
        allow="fullscreen; autoplay"
      />
      <div v-else class="sync-status">正在同步账号数据…</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const gameSrc = ref('')

const bytesToHex = (bytes) => Array.from(new Uint8Array(bytes))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('')

const getBinName = (bin) => (
  bin?.originalName || bin?.filename || bin?.storedName || bin?.name || `BIN-${bin?.id ?? ''}`
)

async function syncRemoteBins() {
  const sessionToken = localStorage.getItem('token')
  if (!sessionToken) return

  const response = await fetch('/api/bins', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  if (!response.ok) throw new Error(`获取远程 BIN 失败：${response.status}`)

  const payload = await response.json()
  const remoteBins = Array.isArray(payload)
    ? payload
    : (payload?.bins || (Array.isArray(payload?.data) ? payload.data : payload?.data?.bins) || [])
  if (!Array.isArray(remoteBins) || remoteBins.length === 0) return

  let localList = []
  try {
    localList = JSON.parse(localStorage.getItem('bin_file_list') || '[]')
  } catch {
    localList = []
  }

  const localById = new Map(localList.map((item) => [String(item.id), item]))
  let order = localList.reduce((max, item) => Math.max(max, Number(item.order) || 0), -1) + 1

  await Promise.all(remoteBins.map(async (bin) => {
    if (bin?.id === undefined || bin?.id === null) return
    try {
      const id = String(bin.id)
      const download = await fetch(`/api/bins/${encodeURIComponent(bin.id)}/download`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      if (!download.ok) return

      const buffer = await download.arrayBuffer()
      const hex = bytesToHex(buffer)
      // 本地通过 Token 管理页打开的 BIN 使用 token.id，远程 BIN 使用 bin.id。
      // 两者 ID 不同，但内容可能完全相同，因此优先按内容去重。
      let existingId = id
      for (const item of localById.values()) {
        if (item.id === id) continue
        const localHex = localStorage.getItem(`bin_data_${item.id}`)
        if (localHex && localHex === hex) {
          existingId = String(item.id)
          break
        }
      }

      localStorage.setItem(`bin_data_${existingId}`, hex)
      const existing = localById.get(existingId)
      localById.set(existingId, {
        ...(existing || {}),
        id: existingId,
        name: getBinName(bin),
        originalName: bin.originalName || existing?.originalName || '',
        byteLength: buffer.byteLength,
        size: `${(buffer.byteLength / 1024).toFixed(1)} KB`,
        order: existing?.order ?? order++,
      })
    } catch (error) {
      console.warn('[GamePlayer] 单个 BIN 同步失败:', bin.id, error)
    }
  }))

  const mergedList = Array.from(localById.values()).sort((a, b) => (a.order || 0) - (b.order || 0))
  localStorage.setItem('bin_file_list', JSON.stringify(mergedList))

  const currentId = localStorage.getItem('current_bin_id')
  if (!currentId || !localStorage.getItem(`bin_data_${currentId}`)) {
    localStorage.setItem('current_bin_id', String(remoteBins[0].id))
  }
}

onMounted(async () => {
  try {
    await syncRemoteBins()
  } catch (error) {
    console.warn('[GamePlayer] 远程 BIN 同步失败，继续使用本地数据:', error)
  } finally {
    gameSrc.value = import.meta.env.BASE_URL + 'game/index.html'
  }
})

function goBack() {
  router.push('/admin/dashboard')
}
</script>

<style scoped>
.game-player {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: #000;
}

.iframe-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.game-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.sync-status {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-size: 16px;
}

.back-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}

.back-btn:active {
  background: rgba(0, 0, 0, 0.8);
}
</style>
