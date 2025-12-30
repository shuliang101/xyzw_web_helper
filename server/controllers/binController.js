import fs from 'fs'
import { saveBinRecord, listBins, deleteBin, getBinById } from '../services/binService.js'
import { logActivity } from '../services/activityService.js'

export const uploadBin = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '未上传文件' })
    }
    const record = saveBinRecord(req.user.id, req.file)
    logActivity(req.user.id, 'bin_upload', `上传 BIN：${record.originalName}`, {
      binId: record.id,
      size: record.size
    })
    res.status(201).json({ bin: record })
  } catch (error) {
    next(error)
  }
}

export const getBins = (req, res, next) => {
  try {
    const bins = listBins(req.user.id)
    res.json({ bins })
  } catch (error) {
    next(error)
  }
}

export const removeBin = (req, res, next) => {
  try {
    const bin = deleteBin(req.user.id, req.params.id)
    logActivity(req.user.id, 'bin_delete', `删除 BIN：${bin?.originalName || bin?.storedName || bin?.id}`, {
      binId: bin?.id
    })
    res.json({ bin })
  } catch (error) {
    next(error)
  }
}

export const downloadBin = (req, res, next) => {
  try {
    const bin = getBinById(req.user.id, req.params.id)
    if (!bin) {
      return res.status(404).json({ message: '文件不存在' })
    }
    logActivity(req.user.id, 'bin_download', `下载 BIN：${bin.originalName}`, {
      binId: bin.id
    })

    res.setHeader('Content-Type', 'application/octet-stream')
    const filename = encodeURIComponent(bin.originalName || 'bin.bin')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`)

    const stream = fs.createReadStream(bin.filePath)
    stream.on('error', (err) => next(err))
    stream.pipe(res)
  } catch (error) {
    next(error)
  }
}
