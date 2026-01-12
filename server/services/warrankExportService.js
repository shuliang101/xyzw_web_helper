import fs from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../assets/templates/salt-warrank-template.xlsx'
)

const ALLY_NAMES = new Set(['梦盟', '龙盟'])
const ENEMY_NAMES = new Set(['大联盟', '正义联盟'])
const ALLY_KEYWORDS = ['梦', '龙']
const ENEMY_KEYWORDS = ['正义', '大联']

const FACTION_ALLY = '盟友'
const FACTION_ENEMY = '敌对'

const DEFAULT_ALLY_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF9CCE0' }
}

const DEFAULT_ENEMY_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFA3CF80' }
}

// 预计分数表：按排名1-20对应的分数
const PREDICTED_SCORES = [
  100, // 第1名
  80,  // 第2名
  70,  // 第3名
  60,  // 第4名
  50,  // 第5名
  40,  // 第6名
  35,  // 第7名
  30,  // 第8名
  25,  // 第9名
  20,  // 第10名
  15,  // 第11名
  10,  // 第12名
  10,  // 第13名
  5,  // 第14名
  5,  // 第15名
  5,   // 第16名
  0,   // 第17名
  0,   // 第18名
  0,   // 第19名
  0    // 第20名
]

const getPredictedScore = (rank) => {
  if (rank < 1 || rank > PREDICTED_SCORES.length) {
    return 0
  }
  return PREDICTED_SCORES[rank - 1]
}

export const generateSaltWarrankWorkbook = async ({
  records = [],
  queryDate,
  templatePath = DEFAULT_TEMPLATE_PATH
} = {}) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('缺少盐场匹配数据，无法生成报表')
  }

  // 创建新工作簿（不使用模板，避免表格样式问题）
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('盐场数据统计')

  // 设置列宽
  worksheet.columns = [
    { width: 10 },   // A: 阵营
    { width: 12 },   // B: 区服
    { width: 16 },   // C: 俱乐部
    { width: 10 },   // D: 红淬
    { width: 10 },   // E: 面板数据1
    { width: 10 },   // F: 面板数据2
    { width: 10 },   // G: 面板数据3
    { width: 10 },   // H: 分数
    { width: 12 },   // I: 预计分数
    { width: 10 },   // J: 总分
    { width: 12 }    // K: 预计排名
  ]

  // 设置默认行高
  worksheet.properties.defaultRowHeight = 20

  // 表头背景色（淡黄色）
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF2CC' }
  }

  // 添加标题行
  const datePrefix = extractDatePrefix(queryDate)
  worksheet.mergeCells('A1:K1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = `${datePrefix}盐场数据统计`.trim()
  titleCell.font = { size: 18, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 30

  // 添加表头行
  const headers = ['阵营', '区服', '俱乐部', '红淬', '面板数据', '', '', '分数', '预计分数', '总分', '预计排名']
  const headerRow = worksheet.getRow(2)
  headerRow.height = 26  // 设置表头行高
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = { bold: true }
    cell.fill = cloneFill(headerFill)
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })
  // 合并面板数据表头
  worksheet.mergeCells('E2:G2')

  const normalized = records.map((record, index) => normalizeRecord(record, index))
  const { allies, enemies } = splitFactions(normalized)

  // 从第3行开始写入数据
  let currentRow = 3
  const allyStartRow = currentRow
  const allyFill = cloneFill(DEFAULT_ALLY_FILL)
  const enemyFill = cloneFill(DEFAULT_ENEMY_FILL)

  // 写入盟友数据
  allies.forEach((record, index) => {
    writeDataRow(worksheet, currentRow, record, allyFill, index + 1)
    currentRow++
  })
  const allyEndRow = currentRow - 1

  // 写入敌对数据
  const enemyStartRow = currentRow
  enemies.forEach((record, index) => {
    writeDataRow(worksheet, currentRow, record, enemyFill, allies.length + index + 1)
    currentRow++
  })
  const enemyEndRow = currentRow - 1

  // 合并阵营列
  if (allies.length > 0) {
    if (allyEndRow > allyStartRow) {
      worksheet.mergeCells(allyStartRow, 1, allyEndRow, 1)
    }
    const allyLabelCell = worksheet.getCell(allyStartRow, 1)
    allyLabelCell.value = FACTION_ALLY
    allyLabelCell.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  if (enemies.length > 0) {
    if (enemyEndRow > enemyStartRow) {
      worksheet.mergeCells(enemyStartRow, 1, enemyEndRow, 1)
    }
    const enemyLabelCell = worksheet.getCell(enemyStartRow, 1)
    enemyLabelCell.value = FACTION_ENEMY
    enemyLabelCell.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer: Buffer.from(buffer),
    allies: allies.length,
    enemies: enemies.length
  }
}

const writeDataRow = (worksheet, rowIndex, record, rowFill, rank) => {
  const row = worksheet.getRow(rowIndex)
  row.height = 26  // 设置行高
  const panelValues = splitPanelValues(record.top3)
  const predictedScore = getPredictedScore(rank)

  const values = [
    '', // 阵营列稍后合并填充
    record.server,
    record.club,
    record.red,
    panelValues[0] || '',
    panelValues[1] || '',
    panelValues[2] || '',
    record.score,
    predictedScore,
    { formula: `H${rowIndex}+I${rowIndex}` },
    rank
  ]

  values.forEach((value, index) => {
    const cell = row.getCell(index + 1)
    cell.value = value
    cell.fill = cloneFill(rowFill)
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
}

const normalizeRecord = (record, index) => {
  const rank = toInt(record?.rank, index + 1)
  const top3 = [record?.redno1, record?.redno2, record?.redno3]
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(',')

  const rawScore = toInt(record?.sRScore ?? record?.score, 0)

  return {
    rank,
    server: cleanText(record?.serverId ?? record?.server ?? record?.ServerId),
    club: cleanText(record?.name ?? record?.club ?? record?.Clubname),
    red: toInt(record?.redQuench ?? record?.red, 0),
    top3,
    score: rawScore < 0 ? 0 : rawScore,
    alliance: cleanText(record?.alliance ?? record?.announcement ?? record?.notice),
    notice: cleanText(record?.announcement ?? record?.notice ?? '')
  }
}

const splitFactions = (entries) => {
  const allies = []
  const enemies = []

  entries.forEach((entry) => {
    const faction = detectFaction(entry)
    console.log('detect', entry.alliance, 'notice', entry.notice, 'club', entry.club, '=>', faction)
    if (faction === 'enemy') {
      enemies.push(entry)
    } else {
      allies.push(entry)
    }
  })

  allies.sort((a, b) => descByRedThenRank(a, b))
  enemies.sort((a, b) => descByRedThenRank(a, b))

  return { allies, enemies }
}

const descByRedThenRank = (a, b) => {
  if (b.red !== a.red) {
    return b.red - a.red
  }
  return a.rank - b.rank
}

const detectFaction = (entry) => {
  const alliance = entry.alliance.replace(/\s+/g, '')
  if (ALLY_NAMES.has(alliance)) {
    return 'ally'
  }
  if (ENEMY_NAMES.has(alliance)) {
    return 'enemy'
  }

  const searchable = alliance + entry.notice + entry.club
  if (ENEMY_KEYWORDS.some((keyword) => searchable.includes(keyword))) {
    return 'enemy'
  }
  if (ALLY_KEYWORDS.some((keyword) => searchable.includes(keyword))) {
    return 'ally'
  }
  return 'ally'
}

const locateSections = (worksheet) => {
  const allyRow = findLabelRow(worksheet, FACTION_ALLY)
  const enemyRow = findLabelRow(worksheet, FACTION_ENEMY)

  if (
    allyRow == null ||
    enemyRow == null ||
    allyRow >= enemyRow
  ) {
    throw new Error('模板中缺少「盟友」或「敌对」区域，无法写入数据')
  }

  const allyRows = range(allyRow, enemyRow)
  const enemyRows = range(enemyRow, findSectionEnd(worksheet, enemyRow) + 1)
  return { allyRows, enemyRows }
}

const range = (start, end) => {
  const values = []
  for (let row = start; row < end; row += 1) {
    values.push(row)
  }
  return values
}

const findLabelRow = (worksheet, label) => {
  for (let row = 1; row <= worksheet.rowCount; row += 1) {
    const value = worksheet.getCell(row, 1).value
    if (typeof value === 'string' && value.trim() === label) {
      return row
    }
  }
  return null
}

const findSectionEnd = (worksheet, startRow) => {
  let row = startRow
  while (row <= worksheet.rowCount + 5) {
    const isEmpty = allColumnsEmpty(worksheet, row, 10)
    if (isEmpty) {
      break
    }
    row += 1
  }
  return row - 1
}

const allColumnsEmpty = (worksheet, row, lastColumn) => {
  for (let column = 1; column <= lastColumn; column += 1) {
    const value = worksheet.getCell(row, column).value
    if (value !== null && value !== undefined && value !== '') {
      return false
    }
  }
  return true
}

const fillRows = (worksheet, targetRows, records, options) => {
  const { label, rowFill, rankStart, allowExtend } = options
  let rows = [...targetRows]
  let items = records

  if (allowExtend && items.length > rows.length) {
    rows = extendRows(worksheet, rows, items.length, rowFill)
  } else if (items.length > rows.length) {
    items = items.slice(0, rows.length)
  }

  items.forEach((record, index) => {
    const rowIndex = rows[index]
    setRow(worksheet, rowIndex, record, label, rowFill)
    worksheet.getCell(rowIndex, 11).value = rankStart + index
  })

  rows.slice(items.length).forEach((rowIndex) => {
    clearRow(worksheet, rowIndex)
    worksheet.getCell(rowIndex, 11).value = null
  })

  return {
    rowIndices: rows,
    written: items.length
  }
}

const extendRows = (worksheet, currentRows, required, rowFill) => {
  if (!currentRows.length) {
    throw new Error('模板中没有可扩展的行')
  }
  const rows = [...currentRows]
  let nextRow = rows[rows.length - 1]
  while (rows.length < required) {
    nextRow += 1
    rows.push(nextRow)
    worksheet.getCell(nextRow, 9).value = worksheet.getCell(nextRow, 9).value ?? 0
    applyRowFill(worksheet, nextRow, rowFill)
  }
  return rows
}

const setRow = (worksheet, rowIndex, record, label, rowFill) => {
  applyRowFill(worksheet, rowIndex, rowFill)
  worksheet.getCell(rowIndex, 1).value = label
  worksheet.getCell(rowIndex, 2).value = record.server
  worksheet.getCell(rowIndex, 3).value = record.club
  worksheet.getCell(rowIndex, 4).value = record.red

  const panelValues = splitPanelValues(record.top3)
  for (let offset = 0; offset < 3; offset += 1) {
    worksheet.getCell(rowIndex, 5 + offset).value = panelValues[offset] ?? null
  }

  worksheet.getCell(rowIndex, 8).value = record.score
  worksheet.getCell(rowIndex, 10).value = {
    formula: `H${rowIndex}+I${rowIndex}`
  }
}

const clearRow = (worksheet, rowIndex) => {
  for (let column = 1; column <= 8; column += 1) {
    worksheet.getCell(rowIndex, column).value = null
  }
  worksheet.getCell(rowIndex, 10).value = {
    formula: `H${rowIndex}+I${rowIndex}`
  }
}

const determineFill = (_worksheet, _rowIndices, fallbackFill) => {
  return cloneFill(fallbackFill)
}

const reapplyFactionFill = (worksheet, rows, rowFill) => {
  if (!rowFill || !rows?.length) {
    return
  }
  rows.forEach((rowIndex) => {
    applyRowFill(worksheet, rowIndex, rowFill)
  })
}

const applyRowFill = (worksheet, rowIndex, rowFill) => {
  if (!rowFill) {
    return
  }
  const row = worksheet.getRow(rowIndex)
  // 清除行级别的填充样式，避免覆盖单元格样式
  row.fill = undefined
  for (let column = 1; column <= 11; column += 1) {
    const clone = cloneFill(rowFill)
    const cell = row.getCell(column)
    cell.fill = clone
  }
}

const cloneFill = (fill) => {
  if (!fill) return fill
  return JSON.parse(JSON.stringify(fill))
}

const splitPanelValues = (text) => {
  if (!text) {
    return []
  }
  return text
    .split(/[，,]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const mergeFactionColumn = (worksheet, rows, label, rowFill) => {
  if (!rows.length) {
    return
  }
  const sorted = [...rows].sort((a, b) => a - b)
  const start = sorted[0]
  const end = sorted[sorted.length - 1]

  Object.values(worksheet._merges || {}).forEach((range) => {
    const { top, bottom, left, right } = range?.model || {}
    if (!top && !bottom) {
      return
    }
    if (left === 1 && right === 1 && !(bottom < start || top > end)) {
      worksheet.unMergeCells(top, left, bottom, right)
    }
  })

  sorted.forEach((rowIndex) => {
    worksheet.getCell(rowIndex, 1).value = null
  })

  if (end > start) {
    worksheet.mergeCells(start, 1, end, 1)
  }
  worksheet.getCell(start, 1).value = label

  // 合并单元格后重新应用填充颜色
  if (rowFill) {
    sorted.forEach((rowIndex) => {
      for (let column = 1; column <= 11; column += 1) {
        worksheet.getCell(rowIndex, column).fill = cloneFill(rowFill)
      }
    })
  }
}

const updateTitle = (worksheet, queryDate) => {
  const titleCell = worksheet.getCell('A1')
  const existing = typeof titleCell.value === 'string' ? titleCell.value : '盐场数据统计'
  const suffix = existing.replace(/^[0-9./\-\s]+/, '') || '盐场数据统计'
  const prefix = extractDatePrefix(queryDate)
  titleCell.value = `${prefix}${suffix}`.trim()
}

const extractDatePrefix = (queryDate) => {
  if (!queryDate) {
    return ''
  }
  const match = /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/.exec(queryDate)
  if (!match) {
    return ''
  }
  const [, yearRaw, monthRaw, dayRaw] = match
  const year = Number(yearRaw) % 100
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  return `${year}.${month}.${day} `
}

const cleanText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

const toInt = (value, fallback = 0) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const match = value.match(/-?\d+/)
    if (match) {
      return parseInt(match[0], 10)
    }
  }
  return fallback
}

const removeTableStyles = (worksheet) => {
  // 移除 Excel 表格 (Table) 对象
  if (worksheet.tables) {
    const tableNames = Object.keys(worksheet.tables)
    tableNames.forEach((name) => {
      try {
        worksheet.removeTable(name)
      } catch (e) {
        // 忽略移除失败
      }
    })
  }
  // 清除内部表格引用
  if (worksheet._tables) {
    worksheet._tables = []
  }
}

const removeConditionalFormatting = (worksheet) => {
  // 移除条件格式
  if (worksheet.conditionalFormattings) {
    worksheet.conditionalFormattings = []
  }
  if (worksheet._cf) {
    worksheet._cf = []
  }
}

const clearTableDefinitions = (workbook, worksheet) => {
  // 方法1: 清除 worksheet 的表格引用
  if (worksheet.tables) {
    Object.keys(worksheet.tables).forEach((name) => {
      try {
        worksheet.removeTable(name)
      } catch (e) {
        // 忽略
      }
    })
  }
  if (worksheet._tables) {
    worksheet._tables = []
  }

  // 方法2: 清除 workbook 级别的表格定义
  if (workbook._tables) {
    workbook._tables = []
  }

  // 方法3: 遍历所有行，清除可能的表格样式引用
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      // 保留单元格的 style 但清除表格相关的样式 ID
      if (cell.style && cell.style.tableId) {
        delete cell.style.tableId
      }
    })
  })
}
