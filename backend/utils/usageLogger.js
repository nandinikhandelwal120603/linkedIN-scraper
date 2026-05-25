import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USAGE_FILE_PATH = path.join(__dirname, '../usage_log.json');

/**
 * Log token and query usage metadata to a central usage database
 * @param {object} params
 * @param {string} params.action - Endpoint or action name (e.g. /generate)
 * @param {string} params.model - Model identifier used
 * @param {number} [params.promptTokens] - Input tokens
 * @param {number} [params.completionTokens] - Output tokens
 * @param {number} [params.serperQueries] - Serper Google search queries
 */
export function logUsage({ action, model, promptTokens = 0, completionTokens = 0, serperQueries = 0 }) {
  try {
    let logs = [];
    if (fs.existsSync(USAGE_FILE_PATH)) {
      const content = fs.readFileSync(USAGE_FILE_PATH, 'utf-8');
      try {
        logs = JSON.parse(content);
      } catch {
        logs = [];
      }
    }

    const entry = {
      timestamp: new Date().toISOString(),
      action,
      model: model || 'unknown',
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      serperQueries
    };

    logs.push(entry);
    fs.writeFileSync(USAGE_FILE_PATH, JSON.stringify(logs, null, 2), 'utf-8');
    console.log(`📊 [USAGE TRACKER] logged ${entry.totalTokens} tokens (${model}) & ${serperQueries} Serper queries for ${action}`);
  } catch (err) {
    console.error('Failed to write usage log:', err);
  }
}
