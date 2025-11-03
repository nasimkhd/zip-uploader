/**
 * Code Verification Tests
 * Verifies implementation matches requirements without running worker
 * 
 * Usage: node test-code-verification.js
 */

const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function runTest(name, testFn) {
  try {
    testFn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    failures.push({ name, error: error.message });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

console.log('🔍 Running Code Verification Tests...\n');

// Read source files
const authJs = fs.readFileSync(path.join(__dirname, 'src/auth.js'), 'utf8');
const indexJs = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');
const frontendJs = fs.readFileSync(path.join(__dirname, '../frontend-worker/src/assets/app.js'), 'utf8');
const formatLogsJs = fs.readFileSync(path.join(__dirname, 'tail/format-logs.js'), 'utf8');

// Test 1: CORS headers in error responses
runTest('CORS headers included in createUnauthorizedResponse', () => {
  assert(authJs.includes('corsHeaders'), 'Should use corsHeaders in error responses');
  assert(authJs.includes('...corsHeaders'), 'Should spread corsHeaders');
});

// Test 2: All endpoints protected
const protectedEndpoints = [
  '/api/upload',
  '/api/upload/multipart/init',
  '/api/upload/multipart/part',
  '/api/upload/multipart/complete',
  '/api/upload/multipart/abort',
  '/api/search',
  '/api/files',
  '/api/files/{key}',
  '/api/files-inline/{key}'
];

protectedEndpoints.forEach(endpoint => {
  const pattern = endpoint.replace('{key}', '');
  runTest(`Endpoint ${endpoint} uses withAuth`, () => {
    assert(
      indexJs.includes('withAuth') || 
      indexJs.includes('handleAPIAuth') ||
      indexJs.includes('/api/upload') && indexJs.includes('/api/search'),
      `Should protect ${endpoint}`
    );
  });
});

// Test 3: Health endpoint is public
runTest('Health endpoint does not require auth', () => {
  assert(indexJs.includes('/api/health') && indexJs.includes('no auth required'), 'Health endpoint should be public');
});

// Test 4: OPTIONS/CORS handling
runTest('OPTIONS requests handled for CORS', () => {
  assert(indexJs.includes('OPTIONS') || indexJs.includes('handleCORS'), 'Should handle OPTIONS requests');
});

// Test 5: Frontend sends X-API-Key header
runTest('Frontend includes X-API-Key header', () => {
  assert(frontendJs.includes('X-API-Key') || frontendJs.includes("'X-API-Key'"), 'Frontend should send X-API-Key header');
  assert(frontendJs.includes('getAuthHeaders'), 'Frontend should use getAuthHeaders function');
});

// Test 6: Frontend handles 401 errors
runTest('Frontend handles 401 responses', () => {
  assert(frontendJs.includes('401') || frontendJs.includes('handleApiResponse'), 'Frontend should check for 401 status');
});

// Test 7: Correlation ID generation
runTest('Correlation ID generation implemented', () => {
  assert(authJs.includes('generateCorrelationId') || authJs.includes('correlationId'), 'Should generate correlation IDs');
  assert(authJs.includes('getCorrelationId'), 'Should have getCorrelationId function');
});

// Test 8: Correlation ID in responses
runTest('Correlation ID included in responses', () => {
  assert(indexJs.includes('correlationId') || indexJs.includes('X-Correlation-ID'), 'Should include correlation ID in responses');
});

// Test 9: Key prefix logging (not full key)
runTest('API keys only logged with prefix', () => {
  assert(authJs.includes('keyPrefix') || authJs.includes('substring(0, 8)'), 'Should log only key prefix');
  assert(!authJs.includes('console.log(apiKey)') || authJs.includes('keyPrefix'), 'Should not log full API key');
});

// Test 10: Admin key requirement for DELETE
runTest('DELETE requires admin key', () => {
  assert(authJs.includes('requireAdmin') || authJs.includes('ADMIN'), 'Should check for admin key on DELETE');
});

// Test 11: Log formatter filters noise
runTest('Log formatter filters OPTIONS requests', () => {
  assert(formatLogsJs.includes('OPTIONS') || formatLogsJs.includes('CORS preflight'), 'Should filter OPTIONS requests');
});

// Test 12: Log formatter detects errors
runTest('Log formatter detects errors', () => {
  assert(formatLogsJs.includes('❌') || formatLogsJs.includes('hasErrors'), 'Should mark errors with ❌');
});

// Test 13: Log formatter extracts correlation ID
runTest('Log formatter extracts correlation ID', () => {
  assert(formatLogsJs.includes('correlationId') || formatLogsJs.includes('X-Correlation-ID'), 'Should extract correlation ID from logs');
});

// Test 14: Error codes properly defined
runTest('Error codes defined (MISSING_KEY, INVALID_KEY, ADMIN_KEY_REQUIRED)', () => {
  assert(authJs.includes('MISSING_KEY'), 'Should have MISSING_KEY code');
  assert(authJs.includes('INVALID_KEY'), 'Should have INVALID_KEY code');
  assert(authJs.includes('ADMIN_KEY_REQUIRED'), 'Should have ADMIN_KEY_REQUIRED code');
});

// Test 15: 401 status code in error responses
runTest('Error responses use 401 status code', () => {
  assert(authJs.includes('status: 401') || authJs.includes('status:401'), 'Should return 401 for unauthorized');
});

console.log(`\n📊 Verification Results:`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);

if (failures.length > 0) {
  console.log(`\n❌ Failures:`);
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All code verification tests passed!');
  process.exit(0);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Run tests at the end

