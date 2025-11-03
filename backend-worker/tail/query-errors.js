/**
 * Query all error logs
 * 
 * Usage: node tail/query-errors.js
 */

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../logs/tail.log');

if (!fs.existsSync(logFile)) {
  console.error(`Log file not found: ${logFile}`);
  process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

const errors = lines.filter(line => line.includes('❌'));

if (errors.length === 0) {
  console.log('No errors in logs');
  process.exit(0);
}

console.log(`Found ${errors.length} errors:\n`);
errors.forEach(line => console.log(line));

