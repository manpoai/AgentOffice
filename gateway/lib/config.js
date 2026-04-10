/**
 * Shared AgentOffice config file helpers.
 * Single source of truth for reading/writing ~/.agentoffice/config.json.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const AGENTOFFICE_HOME = process.env.AGENTOFFICE_HOME || path.join(os.homedir(), '.agentoffice');
const AGENTOFFICE_CONFIG_PATH = path.join(AGENTOFFICE_HOME, 'config.json');

export function readAgentOfficeConfig() {
  try {
    if (!fs.existsSync(AGENTOFFICE_CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(AGENTOFFICE_CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function writeAgentOfficeConfig(nextConfig) {
  fs.mkdirSync(path.dirname(AGENTOFFICE_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(AGENTOFFICE_CONFIG_PATH, JSON.stringify(nextConfig, null, 2));
}
