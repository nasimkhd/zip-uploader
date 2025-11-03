/**
 * Unfiltered Log Formatter for Wrangler Tail
 * Shows ALL logs without filtering noise
 * 
 * Usage: wrangler tail --env staging | node tail/format-logs-all.js
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'tail-all.log');
const stream = fs.createWriteStream(logFile, { flags: 'a' });

const header = `\n${'='.repeat(60)}\nTail ALL (unfiltered) started: ${new Date().toISOString()}\n${'='.repeat(60)}\n`;
stream.write(header);
console.error('[FORMATTER ALL STARTED]');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let lineCount = 0;
let loggedCount = 0;
let buffer = '';
let braceCount = 0;

function writeToLog(message) {
  console.log(message);
  stream.write(message + '\n');
}

rl.on('line', (line) => {
  lineCount++;
  buffer += line + '\n';
  
  braceCount += (line.match(/\{/g) || []).length;
  braceCount -= (line.match(/\}/g) || []).length;
  
  if (braceCount === 0 && buffer.trim()) {
    try {
      const log = JSON.parse(buffer);
      
      const url = log.request?.url || log.event?.request?.url || '';
      const method = log.request?.method || log.event?.request?.method || '';
      const status = log.response?.status || log.event?.response?.status || log.outcome?.status || 'N/A';
      const duration = log.outcome?.duration || 'N/A';
      const timestamp = new Date(log.timestamp || log.eventTimestamp).toISOString();
      
      const isEvent = log.logs && log.logs.length > 0 && log.event;
      
      if (isEvent) {
        const logLines = log.logs.map(l => {
          if (Array.isArray(l.message)) {
            return l.message.join(' ');
          }
          return l.message;
        }).join(' | ');
        
        let formatted = `[${timestamp}] [EVENT] ${logLines}`;
        loggedCount++;
        writeToLog(formatted);
      } else if (url) {
        const urlPath = url.replace(/^https?:\/\/[^/]+/, '');
        let formatted = `[${timestamp}] ${method} ${urlPath} → ${status}`;
        if (duration !== 'N/A') formatted += ` (${duration}ms)`;
        formatted += status >= 400 ? ' ❌' : ' ✓';
        
        if (status >= 400 && log.logs && log.logs.length > 0) {
          const errorLogs = log.logs.filter(l => l.level === 'error');
          if (errorLogs.length > 0) {
            const errorMsg = errorLogs[0].message;
            if (Array.isArray(errorMsg)) {
              formatted += ` | ${errorMsg.join(' ')}`;
            } else {
              formatted += ` | ${errorMsg}`;
            }
          }
        }
        
        loggedCount++;
        writeToLog(formatted);
      }
      
      buffer = '';
      
    } catch (err) {
      console.error(`[LINE ${lineCount}] PARSE ERROR: ${err.message}`);
      stream.write(`[PARSE ERROR] ${err.message}\n`);
      buffer = '';
      braceCount = 0;
    }
  }
});

rl.on('close', () => {
  const summary = `\n[FORMATTER CLOSED] Processed: ${lineCount} lines, Logged: ${loggedCount}`;
  console.error(summary);
  stream.write(summary + '\n');
  stream.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  const summary = `\n[INTERRUPTED] Processed: ${lineCount} lines, Logged: ${loggedCount}`;
  console.error(summary);
  stream.write(summary + '\n');
  stream.end();
  process.exit(0);
});

