/**
 * Verify Tail Tracking Requirements
 * 
 * Checks that:
 * 1. Tail tracking works (logs are being written)
 * 2. Logs are readable (formatted correctly)
 * 3. Correlation IDs are extractable (query tool works)
 * 
 * Usage: node tail/verify-requirements.js
 */

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../logs/tail.log');

console.log('🔍 Verifying Tail Tracking Requirements...\n');

// Requirement 1: Tail tracking works
console.log('1️⃣  Checking: Tail tracking works...');
if (!fs.existsSync(logFile)) {
  console.error('   ❌ FAILED: tail.log does not exist');
  console.error('   → Run: npm run tail');
  process.exit(1);
}

const stats = fs.statSync(logFile);
const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n').filter(l => l.trim());

if (lines.length === 0) {
  console.error('   ❌ FAILED: tail.log is empty');
  console.error('   → Make some requests and ensure tail is running');
  process.exit(1);
}

const hasRecentLogs = lines.some(line => {
  const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T[\d:]+)/);
  if (timestampMatch) {
    const logTime = new Date(timestampMatch[1]);
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return logTime.getTime() > fiveMinutesAgo;
  }
  return false;
});

console.log(`   ✓ tail.log exists (${stats.size} bytes, ${lines.length} lines)`);
if (hasRecentLogs) {
  console.log('   ✓ Recent log entries found');
} else {
  console.log('   ⚠ Warning: No recent log entries (older than 5 minutes)');
  console.log('   → Make a request to generate fresh logs');
}

// Requirement 2: Logs are readable
console.log('\n2️⃣  Checking: Logs are readable...');
const readableFormat = /\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\]\s+\w+\s+\S+\s+→\s+\d+/;
const readableLogs = lines.filter(line => readableFormat.test(line));

if (readableLogs.length === 0) {
  console.error('   ❌ FAILED: No logs match readable format');
  console.error('   → Check format-logs.js is working correctly');
  process.exit(1);
}

console.log(`   ✓ ${readableLogs.length}/${lines.length} logs in readable format`);
console.log('   Example:', readableLogs[0]?.substring(0, 80) || 'N/A');

// Requirement 3: Correlation IDs extractable
console.log('\n3️⃣  Checking: Correlation IDs extractable...');

// Find correlation IDs in logs
const correlationIdPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
const allCorrelationIds = new Set();
lines.forEach(line => {
  const matches = line.match(correlationIdPattern);
  if (matches) {
    matches.forEach(id => allCorrelationIds.add(id));
  }
});

if (allCorrelationIds.size === 0) {
  console.error('   ❌ FAILED: No correlation IDs found in logs');
  console.error('   → Deploy updated worker code to log correlation IDs');
  process.exit(1);
}

console.log(`   ✓ Found ${allCorrelationIds.size} unique correlation IDs in logs`);

// Test query-logs.js with a known correlation ID
const testCorrelationId = Array.from(allCorrelationIds)[0];
const { execSync } = require('child_process');
try {
  const result = execSync(
    `node tail/query-logs.js "${testCorrelationId}"`,
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  );
  const matches = result.match(/Found \d+ log entries/);
  if (matches) {
    console.log(`   ✓ query-logs.js successfully found entries for correlation ID`);
    console.log(`   → Tested with: ${testCorrelationId}`);
  } else {
    console.error('   ❌ FAILED: query-logs.js did not return expected format');
    process.exit(1);
  }
} catch (error) {
  console.error('   ❌ FAILED: query-logs.js error:', error.message);
  process.exit(1);
}

// Summary
console.log('\n✅ All Requirements Met!');
console.log('\nSummary:');
console.log('  ✓ Tail tracking works - logs are being written');
console.log('  ✓ Logs are readable - formatted correctly');
console.log('  ✓ Correlation IDs extractable - query tool works');
console.log('\n🎉 Tail tracking system is operational!');


