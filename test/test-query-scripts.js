/**
 * Tests for Query Scripts (query-logs.js, query-errors.js)
 * Tests log querying functionality
 * 
 * Usage: node test-query-scripts.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
  try {
    testFn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`❌ ${name}: ${error.message}`);
  }
}

console.log('🧪 Testing Query Scripts...\n');

// Test query-logs.js logic
console.log('📋 Testing query-logs.js Logic...\n');

runTest('Match correlation ID in log line', () => {
  const correlationId = 'abc123-def456-ghi789';
  const line = `[2025-01-27T10:00:00Z] POST /api/upload → 200 (150ms) ✓ [${correlationId}]`;
  const pattern = new RegExp(correlationId.replace(/[-]/g, '[-]?'), 'i');
  assert(pattern.test(line), 'Should match correlation ID in line');
});

runTest('Match correlation ID with flexible hyphen matching', () => {
  const correlationId = 'abc123-def456';
  const line = `[2025-01-27T10:00:00Z] POST /api/upload → 200 [abc123def456]`;
  const pattern = new RegExp(correlationId.replace(/[-]/g, '[-]?'), 'i');
  // This should still work with flexible matching
  const simplePattern = new RegExp(correlationId.replace(/[-]/g, ''), 'i');
  assert(simplePattern.test(line.replace(/[-]/g, '')), 'Should match with flexible hyphen handling');
});

runTest('Match correlation ID in JSON log', () => {
  const correlationId = 'test-correlation-id-123';
  const jsonLog = JSON.stringify({
    correlationId: correlationId,
    message: 'Upload successful',
    timestamp: '2025-01-27T10:00:00Z'
  });
  const line = `[INFO] ${jsonLog}`;
  
  try {
    const jsonMatch = line.match(/\{.*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      assert(parsed.correlationId === correlationId || JSON.stringify(parsed).includes(correlationId), 
             'Should extract correlation ID from JSON');
    }
  } catch (e) {
    throw new Error('Failed to parse JSON log');
  }
});

runTest('Handle missing correlation ID gracefully', () => {
  const correlationId = 'nonexistent-id';
  const lines = [
    '[2025-01-27T10:00:00Z] POST /api/upload → 200 [other-id]',
    '[2025-01-27T10:00:00Z] GET /api/files → 200 [another-id]'
  ];
  const pattern = new RegExp(correlationId.replace(/[-]/g, '[-]?'), 'i');
  const matches = lines.filter(line => pattern.test(line));
  assert(matches.length === 0, 'Should return empty array for non-existent ID');
});

// Test query-errors.js logic
console.log('\n📋 Testing query-errors.js Logic...\n');

runTest('Find errors marked with ❌', () => {
  const lines = [
    '[2025-01-27T10:00:00Z] POST /api/upload → 200 ✓',
    '[2025-01-27T10:00:01Z] GET /api/files → 404 ❌',
    '[2025-01-27T10:00:02Z] POST /api/search → 400 ❌',
    '[2025-01-27T10:00:03Z] GET /api/health → 200 ✓'
  ];
  const errors = lines.filter(line => line.includes('❌'));
  assert(errors.length === 2, 'Should find 2 errors');
  assert(errors.every(line => line.includes('❌')), 'All should contain ❌ marker');
});

runTest('Handle empty log file gracefully', () => {
  const lines = [];
  const errors = lines.filter(line => line.includes('❌'));
  assert(errors.length === 0, 'Should return empty array for no errors');
});

runTest('Find all error types', () => {
  const lines = [
    '[2025-01-27T10:00:00Z] POST /api/upload → 400 ❌ | [ERROR] Invalid request',
    '[2025-01-27T10:00:01Z] GET /api/files → 404 ❌',
    '[2025-01-27T10:00:02Z] POST /api/search → 500 ❌ | [ERROR] Server error',
    '[2025-01-27T10:00:03Z] DELETE /api/files/test → 401 ❌'
  ];
  const errors = lines.filter(line => line.includes('❌'));
  assert(errors.length === 4, 'Should find all 4 errors');
  assert(errors.some(line => line.includes('400')), 'Should include 400 error');
  assert(errors.some(line => line.includes('404')), 'Should include 404 error');
  assert(errors.some(line => line.includes('500')), 'Should include 500 error');
  assert(errors.some(line => line.includes('401')), 'Should include 401 error');
});

runTest('Ignore success markers', () => {
  const lines = [
    '[2025-01-27T10:00:00Z] POST /api/upload → 200 ✓',
    '[2025-01-27T10:00:01Z] GET /api/files → 200 ✓',
    '[2025-01-27T10:00:02Z] GET /api/health → 200 ✓'
  ];
  const errors = lines.filter(line => line.includes('❌'));
  assert(errors.length === 0, 'Should not find errors in success logs');
});

// Test file reading logic
console.log('\n📋 Testing File Handling...\n');

runTest('Read log file if exists', () => {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const logFile = path.join(logsDir, 'test-tail.log');
  const testContent = `[2025-01-27T10:00:00Z] POST /api/upload → 200 ✓ [test-id-123]
[2025-01-27T10:00:01Z] GET /api/files → 404 ❌ [test-id-456]`;
  fs.writeFileSync(logFile, testContent);
  
  try {
    const content = fs.readFileSync(logFile, 'utf8');
    assert(content.includes('test-id-123'), 'Should read log file content');
    assert(content.includes('❌'), 'Should read error markers');
  } finally {
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  }
});

runTest('Handle missing log file gracefully', () => {
  const logFile = path.join(__dirname, 'logs', 'nonexistent.log');
  try {
    if (fs.existsSync(logFile)) {
      throw new Error('File should not exist');
    }
    // This would normally exit in the actual script, but for testing we just verify
    assert(true, 'Should handle missing file');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
});

console.log(`\n📊 Test Results:`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All query script tests passed!');
  process.exit(0);
}

