/**
 * Test suite for log parser
 * Tests log formatting and parsing logic
 * 
 * Usage: npm run test:tail-parser
 */

const assert = require('assert');

// Test data matching wrangler tail format
const testLogs = [
  {
    timestamp: '2025-11-03T14:22:15Z',
    request: { method: 'POST', url: 'https://api.example.com/api/upload' },
    response: { status: 200 },
    outcome: { duration: 145, ok: true }
  },
  {
    timestamp: '2025-11-03T14:22:16Z',
    event: { request: { method: 'GET' } },
    logs: [
      { level: 'info', message: ['Worker:', 'onix-generator', 'Event:', 'onix-complete'] }
    ]
  },
  {
    timestamp: '2025-11-03T14:22:17Z',
    request: { method: 'POST', url: 'https://api.example.com/api/search' },
    response: { status: 400 },
    outcome: { duration: 23, ok: false },
    logs: [
      { level: 'error', message: 'Invalid query' }
    ]
  },
  {
    timestamp: '2025-11-03T14:22:18Z',
    request: { method: 'GET', url: 'https://api.example.com/api/files/test.zip' },
    response: { status: 404 },
    outcome: { duration: 12, ok: false }
  }
];

/**
 * Format log entry (similar to format-logs.js logic)
 */
function formatLog(log) {
  const url = log.request?.url || log.event?.request?.url || '';
  const method = log.request?.method || log.event?.request?.method || 'WORKER';
  const status = log.response?.status || log.event?.response?.status || log.outcome?.status || 'N/A';
  const duration = log.outcome?.duration || 'N/A';
  const timestamp = log.timestamp || log.eventTimestamp;
  
  const urlPath = url.replace(/^https?:\/\/[^/]+/, '') || 'event';
  let result = `[${timestamp}] ${method} ${urlPath} → ${status}`;
  if (duration !== 'N/A') result += ` (${duration}ms)`;
  
  // Add error marker if error detected
  const hasErrors = log.outcome?.ok === false || 
                    log.response?.status >= 400 ||
                    (log.logs && log.logs.some(l => l.level === 'error'));
  
  if (hasErrors) {
    result += ' ❌';
  } else {
    result += ' ✓';
  }
  
  return result;
}

// Run tests
console.log('Testing log parser...\n');

let testsPassed = 0;
let testsFailed = 0;

testLogs.forEach((log, idx) => {
  try {
    const formatted = formatLog(log);
    console.log(`Test ${idx + 1}: ${formatted}`);
    
    // Assertions
    assert(formatted.includes(log.timestamp), 'Should include timestamp');
    
    if (log.response?.status) {
      assert(formatted.includes(String(log.response.status)), 'Should include status code');
    }
    
    if (log.outcome?.duration) {
      assert(formatted.includes(`${log.outcome.duration}ms`), 'Should include duration');
    }
    
    // Check error marker
    if (log.response?.status >= 400 || log.outcome?.ok === false) {
      assert(formatted.includes('❌'), 'Should mark errors with ❌');
    } else {
      assert(formatted.includes('✓'), 'Should mark success with ✓');
    }
    
    testsPassed++;
  } catch (error) {
    console.error(`❌ Test ${idx + 1} failed: ${error.message}`);
    testsFailed++;
  }
});

console.log(`\n✅ Tests passed: ${testsPassed}/${testLogs.length}`);
if (testsFailed > 0) {
  console.error(`❌ Tests failed: ${testsFailed}/${testLogs.length}`);
  process.exit(1);
} else {
  console.log('✅ All parser tests passed');
  process.exit(0);
}

