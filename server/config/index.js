import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.resolve(__dirname, '..')

export const config = {
  port: process.env.SERVER_PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'xyzw-dev-secret',
  tokenExpiresIn: '7d',
  uploadDir: path.join(rootDir, 'data', 'bin'),
  databaseFile: path.join(rootDir, 'data', 'app.db'),
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  }
}
