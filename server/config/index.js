import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const runtimeConfigPath = process.env.RUNTIME_CONFIG
  ? path.resolve(process.env.RUNTIME_CONFIG)
  : path.resolve(rootDir, "..", "runtime.config.json");

const loadRuntimeConfig = () => {
  if (!fs.existsSync(runtimeConfigPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(runtimeConfigPath, "utf8"));
  } catch (error) {
    console.warn(`[config] Failed to read runtime config: ${runtimeConfigPath}`, error);
    return {};
  }
};

const runtimeConfig = loadRuntimeConfig();
const runtimeConfigDir = path.dirname(runtimeConfigPath);

const resolveRuntimePath = (value, fallback) => {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(runtimeConfigDir, value);
};

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : resolveRuntimePath(runtimeConfig.dataDir, path.join(rootDir, "data"));
const clubCarDataDir = path.join(dataDir, "club-car");

export const config = {
  port: process.env.SERVER_PORT || runtimeConfig.serverPort || 4000,
  jwtSecret: process.env.JWT_SECRET || runtimeConfig.jwtSecret || "xyzw-dev-secret",
  tokenExpiresIn: process.env.TOKEN_EXPIRES_IN || runtimeConfig.tokenExpiresIn || null,
  dataDir,
  uploadDir: path.join(dataDir, "bin"),
  clubCarDataDir,
  clubCarUploadDir: path.join(clubCarDataDir, "uploads"),
  clubCarMasterBinDir: path.join(clubCarDataDir, "master-bin"),
  clubCarMemberBinDir: path.join(clubCarDataDir, "member-bin"),
  databaseFile: path.join(dataDir, "app.db"),
  admin: {
    username: process.env.ADMIN_USERNAME || runtimeConfig.admin?.username || "admin",
    password: process.env.ADMIN_PASSWORD || runtimeConfig.admin?.password || "admin123",
  },
};
