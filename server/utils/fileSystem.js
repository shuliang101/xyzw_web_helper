import fs from 'fs'

export const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export const removeFileIfExists = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}
