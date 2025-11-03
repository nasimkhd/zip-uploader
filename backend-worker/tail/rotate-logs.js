/**
 * Log Rotation Script
 * Archives old logs with date suffix
 * 
 * Usage: node tail/rotate-logs.js [date]
 * If no date provided, uses current date
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
const tailLog = path.join(logsDir, 'tail.log');
const filterLog = path.join(logsDir, 'filter.log');
const tailAllLog = path.join(logsDir, 'tail-all.log');

// Get date suffix (YYYY-MM-DD)
const dateArg = process.argv[2];
const dateSuffix = dateArg || new Date().toISOString().split('T')[0];

function rotateLog(logPath, suffix) {
  if (!fs.existsSync(logPath)) {
    console.log(`Log file not found: ${logPath}`);
    return false;
  }
  
  const stats = fs.statSync(logPath);
  if (stats.size === 0) {
    console.log(`Skipping empty log: ${logPath}`);
    return false;
  }
  
  const dir = path.dirname(logPath);
  const basename = path.basename(logPath, '.log');
  const archivePath = path.join(dir, `${basename}.${suffix}.log`);
  
  try {
    fs.renameSync(logPath, archivePath);
    console.log(`✓ Rotated ${path.basename(logPath)} → ${path.basename(archivePath)}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to rotate ${logPath}: ${error.message}`);
    return false;
  }
}

console.log(`Rotating logs for date: ${dateSuffix}\n`);

let rotated = 0;
if (rotateLog(tailLog, dateSuffix)) rotated++;
if (rotateLog(filterLog, dateSuffix)) rotated++;
if (rotateLog(tailAllLog, dateSuffix)) rotated++;

if (rotated === 0) {
  console.log('\nNo logs to rotate.');
} else {
  console.log(`\n✓ Rotated ${rotated} log file(s).`);
  console.log('New logs will be created automatically on next tail run.');
}

