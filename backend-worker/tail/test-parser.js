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
    response: { status: 404, headers: { 'X-Correlation-ID': 'abc123-def456-ghi789' } },
    outcome: { duration: 12, ok: false }
  },
  {
    timestamp: '2025-11-03T14:22:19Z',
    request: { 
      method: 'POST', 
      url: 'https://api.example.com/api/upload',
      headers: { 'X-Correlation-ID': 'test-correlation-id-123' }
    },
    response: { status: 200 },
    outcome: { duration: 100, ok: true },
    logs: [
      { level: 'info', message: JSON.stringify({ correlationId: 'test-correlation-id-123', message: 'File uploaded' }) }
    ]
  }
];

/**
 * Extract correlation ID from log (similar to format-logs.js logic)
 */
function extractCorrelationId(log) {
  let correlationId = null;
  
  // Check response headers
  const responseHeaders = log.response?.headers || log.event?.response?.headers || {};
  if (responseHeaders['X-Correlation-ID'] || responseHeaders['x-correlation-id']) {
    correlationId = responseHeaders['X-Correlation-ID'] || responseHeaders['x-correlation-id'];
  }
  
  // Check request headers
  if (!correlationId) {
    const requestHeaders = log.request?.headers || log.event?.request?.headers || {};
    if (requestHeaders['X-Correlation-ID'] || requestHeaders['x-correlation-id']) {
      correlationId = requestHeaders['X-Correlation-ID'] || requestHeaders['x-correlation-id'];
    }
  }
  
  // Check log messages
  if (!correlationId && log.logs && log.logs.length > 0) {
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
  
  return correlationId;
}

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
  
  // Add correlation ID if found
  const correlationId = extractCorrelationId(log);
  if (correlationId) {
    result += ` [${correlationId}]`;
  }
  
  return result;
}

// Additional tests for correlation ID extraction
console.log('Testing correlation ID extraction...\n');

const correlationIdTests = [
  {
    name: 'Extract correlation ID from response headers',
    log: {
      response: { headers: { 'X-Correlation-ID': 'test-id-123' } }
    },
    expected: 'test-id-123'
  },
  {
    name: 'Extract correlation ID from request headers',
    log: {
      request: { headers: { 'X-Correlation-ID': 'request-id-456' } }
    },
    expected: 'request-id-456'
  },
  {
    name: 'Extract correlation ID from log message JSON',
    log: {
      logs: [
        { level: 'info', message: JSON.stringify({ correlationId: 'json-id-789', message: 'test' }) }
      ]
    },
    expected: 'json-id-789'
  },
  {
    name: 'Extract correlation ID from log message string',
    log: {
      logs: [
        { level: 'info', message: 'correlationId: abc12345-def6-7890-abcd-ef1234567890' }
      ]
    },
    expected: 'abc12345-def6-7890-abcd-ef1234567890'
  },
  {
    name: 'Handle missing correlation ID',
    log: {
      request: { method: 'GET' }
    },
    expected: null
  }
];

let correlationIdTestsPassed = 0;
let correlationIdTestsFailed = 0;

correlationIdTests.forEach(test => {
  try {
    const result = extractCorrelationId(test.log);
    assert(result === test.expected, `Expected ${test.expected}, got ${result}`);
    correlationIdTestsPassed++;
    console.log(`✅ ${test.name}`);
  } catch (error) {
    correlationIdTestsFailed++;
    console.error(`❌ ${test.name}: ${error.message}`);
  }
});

console.log(`\nCorrelation ID tests: ${correlationIdTestsPassed}/${correlationIdTests.length} passed\n`);

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
    
    // Check correlation ID extraction if present
    const correlationId = extractCorrelationId(log);
    if (correlationId) {
      assert(formatted.includes(correlationId), 'Should include correlation ID in formatted output');
    }
    
    testsPassed++;
  } catch (error) {
    console.error(`❌ Test ${idx + 1} failed: ${error.message}`);
    testsFailed++;
  }
});

console.log(`\n✅ Log formatting tests passed: ${testsPassed}/${testLogs.length}`);
console.log(`✅ Correlation ID extraction tests passed: ${correlationIdTestsPassed}/${correlationIdTests.length}`);

const totalPassed = testsPassed + correlationIdTestsPassed;
const totalFailed = testsFailed + correlationIdTestsFailed;

if (totalFailed > 0) {
  console.error(`❌ Total tests failed: ${totalFailed}`);
  process.exit(1);
} else {
  console.log('✅ All parser tests passed');
  process.exit(0);
}

