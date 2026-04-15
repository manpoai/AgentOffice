/**
 * Shared AOSE config file helpers.
 * Single source of truth for reading/writing ~/.aose/config.json.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const AOSE_HOME = process.env.AOSE_HOME || path.join(os.homedir(), '.aose');
const AOSE_CONFIG_PATH = path.join(AOSE_HOME, 'config.json');

export function readAoseConfig() {
  try {
    if (!fs.existsSync(AOSE_CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(AOSE_CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function writeAoseConfig(nextConfig) {
  fs.mkdirSync(path.dirname(AOSE_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(AOSE_CONFIG_PATH, JSON.stringify(nextConfig, null, 2));
}
