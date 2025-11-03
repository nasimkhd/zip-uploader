/**
 * Query logs by correlation ID
 * 
 * Usage: node tail/query-logs.js <correlation-id>
 */

const fs = require('fs');
const path = require('path');

const correlationId = process.argv[2];
if (!correlationId) {
  console.error('Usage: node tail/query-logs.js <correlation-id>');
  process.exit(1);
}

const logFile = path.join(__dirname, '../logs/tail.log');

if (!fs.existsSync(logFile)) {
  console.error(`Log file not found: ${logFile}`);
  console.error('Run: npm run tail');
  process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

// Enhanced matching: look for correlation ID in brackets or in log content
const correlationIdPattern = new RegExp(correlationId.replace(/[-]/g, '[-]?'), 'i');
const matches = lines.filter(line => {
  // Check if line contains the correlation ID
  if (correlationIdPattern.test(line)) {
    return true;
  }
  // Also try to parse JSON logs if present
  try {
    const jsonMatch = line.match(/\{.*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.correlationId === correlationId || 
          JSON.stringify(parsed).includes(correlationId)) {
        return true;
      }
    }
  } catch (e) {
    // Not JSON, continue
  }
  return false;
});

if (matches.length === 0) {
  console.error(`No logs found for correlation ID: ${correlationId}`);
  console.error('Tip: Check logs/tail.log for related entries');
  process.exit(1);
}

console.log(`Found ${matches.length} log entries for ${correlationId}:\n`);
matches.forEach((line, idx) => {
  console.log(`${idx + 1}. ${line}`);
});

