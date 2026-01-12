import { generateSaltWarrankWorkbook } from '../services/warrankExportService.js'

export const exportMatchDetails = async (req, res, next) => {
  try {
    const { queryDate, records } = req.body || {}

    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ message: '缺少盐场匹配数据，无法导出' })
    }

    const safeDate = typeof queryDate === 'string' ? queryDate.trim() : ''
    const { buffer } = await generateSaltWarrankWorkbook({
      records,
      queryDate: safeDate
    })

    const formattedDate = (safeDate || new Date().toISOString().slice(0, 10))
      .replace(/\//g, '-')
    const fileName = `盐场匹配详情_${formattedDate}.xlsx`

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}
