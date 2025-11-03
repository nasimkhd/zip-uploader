/**
 * Smart Log Formatter for Wrangler Tail
 * Filters noise and shows diagnostic events
 * 
 * Usage: wrangler tail --env staging | node tail/format-logs.js
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'tail.log');
const filterLogFile = path.join(logsDir, 'filter.log');
const stream = fs.createWriteStream(logFile, { flags: 'a' });
const filterStream = fs.createWriteStream(filterLogFile, { flags: 'a' });

// Add header
const header = `\n${'='.repeat(60)}\nTail started: ${new Date().toISOString()}\n${'='.repeat(60)}\n`;
stream.write(header);
console.error('[FORMATTER STARTED]');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let lineCount = 0;
let loggedCount = 0;
let filteredCount = 0;
let buffer = '';
let braceCount = 0;

function writeToLog(message) {
  console.log(message);
  stream.write(message + '\n');
}

function writeToFilter(reason, data) {
  filteredCount++;
  const entry = `[${new Date().toISOString()}] ${reason}\n${JSON.stringify(data, null, 2)}\n`;
  filterStream.write(entry);
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
      const outcome = log.outcome;
      
      // Check for diagnostic value
      const hasLogs = log.logs && log.logs.length > 0;
      const hasErrors = outcome?.ok === false || 
                        outcome === 'canceled' ||
                        status >= 400 || 
                        (log.logs && log.logs.some(l => l.level === 'error' || l.level === 'warn'));
      
      if (hasLogs || hasErrors) {
        const urlPath = url.replace(/^https?:\/\/[^/]+/, '') || 'event';
        let formatted = `[${timestamp}] ${method || 'WORKER'} ${urlPath} → ${status}`;
        if (duration !== 'N/A') formatted += ` (${duration}ms)`;
        
        if (hasErrors) {
          formatted += ' ❌';
        } else {
          formatted += ' ✓';
        }
        
        // Extract correlation ID from logs or headers
        let correlationId = null;
        if (log.logs && log.logs.length > 0) {
          // Try to find correlation ID in log messages
          for (const logEntry of log.logs) {
            const msg = Array.isArray(logEntry.message) ? logEntry.message.join(' ') : String(logEntry.message);
            const corrMatch = msg.match(/correlationId["\s:]+([a-f0-9-]{36})/i) || 
                              msg.match(/correlation["\s:]+([a-f0-9-]{36})/i);
            if (corrMatch) {
              correlationId = corrMatch[1];
              break;
            }
            // Also check if message is JSON
            try {
              const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;
              if (parsed.correlationId) {
                correlationId = parsed.correlationId;
                break;
              }
            } catch (e) {
              // Not JSON, continue
            }
          }
        }
        
        if (hasLogs) {
          const logLines = log.logs.map(l => {
            const level = l.level ? `[${l.level.toUpperCase()}]` : '';
            const msg = Array.isArray(l.message) ? l.message.join(' ') : l.message;
            return `${level} ${msg}`.trim();
          }).join(' | ');
          formatted += ` | ${logLines}`;
        }
        
        // Append correlation ID if found
        if (correlationId) {
          formatted += ` [${correlationId}]`;
        }
        
        loggedCount++;
        writeToLog(formatted);
        buffer = '';
        return;
      }
      
      // Filter noise
      if (!url || url === '/') {
        writeToFilter('SKIP: Root request', { url, status });
        buffer = '';
        return;
      }
      
      if (method === 'OPTIONS' && status < 300) {
        writeToFilter('SKIP: CORS preflight', { url, status });
        buffer = '';
        return;
      }
      
      if ((url.includes('.js') || url.includes('.css') || url.includes('.png')) && status < 300) {
        writeToFilter('SKIP: Static asset', { url, status });
        buffer = '';
        return;
      }
      
      // Log other requests
      const urlPath = url.replace(/^https?:\/\/[^/]+/, '');
      let formatted = `[${timestamp}] ${method} ${urlPath} → ${status}`;
      if (duration !== 'N/A') formatted += ` (${duration}ms)`;
      formatted += status < 300 ? ' ✓' : ' ⚠';
      
      loggedCount++;
      writeToLog(formatted);
      buffer = '';
      
    } catch (err) {
      console.error(`[PARSE ERROR] ${err.message}`);
      stream.write(`[ERROR] ${err.message}\n`);
      buffer = '';
      braceCount = 0;
    }
  }
});

rl.on('close', () => {
  const summary = `\n[FORMATTER CLOSED] Processed: ${lineCount}, Logged: ${loggedCount}, Filtered: ${filteredCount}`;
  console.error(summary);
  stream.write(summary + '\n');
  filterStream.write(summary + '\n');
  stream.end();
  filterStream.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  const summary = `\n[INTERRUPTED] Processed: ${lineCount}, Logged: ${loggedCount}`;
  console.error(summary);
  stream.write(summary + '\n');
  stream.end();
  process.exit(0);
});

