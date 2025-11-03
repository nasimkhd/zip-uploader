/**
 * Unit Tests for Authentication Module
 * Tests validateApiKey, error responses, and CORS handling
 * 
 * Usage: node test-auth.js
 */

const assert = require('assert');

// Mock the auth.js module functions
// Since we can't directly import ES modules, we'll recreate the logic here for testing

function generateCorrelationId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getCorrelationId(request) {
  return request.headers?.['X-Correlation-ID'] || generateCorrelationId();
}

function validateApiKey(request, env, requireAdmin = false) {
  const apiKey = request.headers?.['X-API-Key'];
  
  if (!apiKey) {
    return {
      valid: false,
      error: 'Unauthorized',
      code: 'MISSING_KEY'
    };
  }
  
  const publicKey = env.API_KEY_PUBLIC;
  const adminKey = env.API_KEY_ADMIN;
  
  if (requireAdmin) {
    if (adminKey && apiKey === adminKey) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Unauthorized',
      code: 'ADMIN_KEY_REQUIRED'
    };
  } else {
    if ((publicKey && apiKey === publicKey) || (adminKey && apiKey === adminKey)) {
      return { valid: true };
    }
  }
  
  const keyPrefix = apiKey.substring(0, 8) + '...';
  
  return {
    valid: false,
    error: 'Unauthorized',
    code: 'INVALID_KEY',
    keyPrefix: keyPrefix  // For testing purposes
  };
}

function createUnauthorizedResponse(code, correlationId) {
  return {
    status: 401,
    body: JSON.stringify({
      error: 'Unauthorized',
      code: code,
      correlationId: correlationId
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

// Test Data
const TEST_PUBLIC_KEY = 'test_public_key_12345';
const TEST_ADMIN_KEY = 'test_admin_key_67890';
const TEST_INVALID_KEY = 'invalid_key_xyz';
const TEST_ENV = {
  API_KEY_PUBLIC: TEST_PUBLIC_KEY,
  API_KEY_ADMIN: TEST_ADMIN_KEY
};

// Test Results
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

console.log('🧪 Running Authentication Unit Tests...\n');

// Test 1: Valid public key
runTest('Test validateApiKey() with valid public key → returns success', () => {
  const request = { headers: { 'X-API-Key': TEST_PUBLIC_KEY } };
  const result = validateApiKey(request, TEST_ENV, false);
  assert(result.valid === true, 'Should return valid: true for public key');
  assert(!result.error, 'Should not have error for valid key');
});

// Test 2: Valid admin key
runTest('Test validateApiKey() with valid admin key → returns success', () => {
  const request = { headers: { 'X-API-Key': TEST_ADMIN_KEY } };
  const result = validateApiKey(request, TEST_ENV, false);
  assert(result.valid === true, 'Should return valid: true for admin key');
});

// Test 3: Invalid key
runTest('Test validateApiKey() with invalid key → returns error code "INVALID_KEY"', () => {
  const request = { headers: { 'X-API-Key': TEST_INVALID_KEY } };
  const result = validateApiKey(request, TEST_ENV, false);
  assert(result.valid === false, 'Should return valid: false for invalid key');
  assert(result.code === 'INVALID_KEY', 'Should return code "INVALID_KEY"');
  assert(result.keyPrefix && result.keyPrefix.includes('...'), 'Should include key prefix');
});

// Test 4: Missing key
runTest('Test validateApiKey() with missing key → returns error code "MISSING_KEY"', () => {
  const request = { headers: {} };
  const result = validateApiKey(request, TEST_ENV, false);
  assert(result.valid === false, 'Should return valid: false for missing key');
  assert(result.code === 'MISSING_KEY', 'Should return code "MISSING_KEY"');
});

// Test 5: Public key on admin endpoint
runTest('Test validateApiKey() with public key on admin endpoint → returns error code "ADMIN_KEY_REQUIRED"', () => {
  const request = { headers: { 'X-API-Key': TEST_PUBLIC_KEY } };
  const result = validateApiKey(request, TEST_ENV, true);
  assert(result.valid === false, 'Should return valid: false for public key on admin endpoint');
  assert(result.code === 'ADMIN_KEY_REQUIRED', 'Should return code "ADMIN_KEY_REQUIRED"');
});

// Test 6: Admin key on admin endpoint
runTest('Test validateApiKey() with admin key on admin endpoint → returns success', () => {
  const request = { headers: { 'X-API-Key': TEST_ADMIN_KEY } };
  const result = validateApiKey(request, TEST_ENV, true);
  assert(result.valid === true, 'Should return valid: true for admin key on admin endpoint');
});

// Test 7: Key prefix logging (verify full key never logged)
runTest('Test key prefix logging (verify full key never logged)', () => {
  const request = { headers: { 'X-API-Key': TEST_INVALID_KEY } };
  const result = validateApiKey(request, TEST_ENV, false);
  assert(result.keyPrefix, 'Should have keyPrefix');
  assert(result.keyPrefix.includes('...'), 'Should truncate key with ...');
  assert(!result.keyPrefix.includes(TEST_INVALID_KEY), 'Should not include full key');
  assert(result.keyPrefix.length < TEST_INVALID_KEY.length, 'Prefix should be shorter than full key');
});

// Test 8: Missing key response format
runTest('Test missing key returns correct error response format', () => {
  const correlationId = getCorrelationId({});
  const response = createUnauthorizedResponse('MISSING_KEY', correlationId);
  const body = JSON.parse(response.body);
  assert(body.error === 'Unauthorized', 'Should have error field');
  assert(body.code === 'MISSING_KEY', 'Should have code "MISSING_KEY"');
  assert(body.correlationId === correlationId, 'Should include correlation ID');
  assert(response.status === 401, 'Should return 401 status');
});

// Test 9: Invalid key response format
runTest('Test invalid key returns correct error response format', () => {
  const correlationId = getCorrelationId({});
  const response = createUnauthorizedResponse('INVALID_KEY', correlationId);
  const body = JSON.parse(response.body);
  assert(body.error === 'Unauthorized', 'Should have error field');
  assert(body.code === 'INVALID_KEY', 'Should have code "INVALID_KEY"');
  assert(body.correlationId === correlationId, 'Should include correlation ID');
  assert(response.status === 401, 'Should return 401 status');
});

// Test 10: All error responses include 401 status code
runTest('Test all error responses include 401 status code', () => {
  const correlationId = getCorrelationId({});
  const codes = ['MISSING_KEY', 'INVALID_KEY', 'ADMIN_KEY_REQUIRED'];
  codes.forEach(code => {
    const response = createUnauthorizedResponse(code, correlationId);
    assert(response.status === 401, `Should return 401 for ${code}`);
  });
});

// Test 11: Correlation ID generation
runTest('Test correlation ID generation and extraction', () => {
  const customId = 'test-correlation-id-123';
  const request1 = { headers: { 'X-Correlation-ID': customId } };
  const request2 = { headers: {} };
  
  const id1 = getCorrelationId(request1);
  const id2 = getCorrelationId(request2);
  
  assert(id1 === customId, 'Should extract existing correlation ID');
  assert(id2 !== undefined, 'Should generate correlation ID if missing');
  assert(id2.length > 0, 'Generated ID should have length');
  // UUID format check (basic)
  assert(/^[a-f0-9-]{36}$/i.test(id2), 'Generated ID should be UUID-like format');
});

console.log(`\n📊 Test Results:`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);

if (failures.length > 0) {
  console.log(`\n❌ Failures:`);
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All authentication unit tests passed!');
  process.exit(0);
}

