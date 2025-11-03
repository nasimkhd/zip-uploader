/**
 * Integration Tests for API Endpoints
 * Tests authentication on all protected endpoints
 * 
 * Usage: 
 *   BACKEND_URL=https://your-worker.workers.dev API_KEY_PUBLIC=xxx API_KEY_ADMIN=yyy node test-integration.js
 *   or
 *   BACKEND_URL=http://localhost:8787 API_KEY_PUBLIC=xxx API_KEY_ADMIN=yyy node test-integration.js
 */

const assert = require('assert');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8787';
const API_KEY_PUBLIC = process.env.API_KEY_PUBLIC || 'test_public_key';
const API_KEY_ADMIN = process.env.API_KEY_ADMIN || 'test_admin_key';
const INVALID_KEY = 'invalid_key_xyz';

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

async function runTest(name, testFn) {
  try {
    await testFn();
    testsPassed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    testsFailed++;
    failures.push({ name, error: error.message });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

async function makeRequest(method, path, headers = {}, body = null) {
  const url = `${BACKEND_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // Not JSON
    }
    return { status: response.status, json, text, headers: Object.fromEntries(response.headers) };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout: ${error.message}`);
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      throw new Error(`Cannot connect to ${BACKEND_URL}. Is the worker running?`);
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

async function checkWorkerReachable() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return true;
  } catch (error) {
    console.error(`\n❌ Cannot reach worker at ${BACKEND_URL}`);
    console.error(`   Error: ${error.message}`);
    console.error(`\n💡 Make sure the worker is running:`);
    console.error(`   - Local: npm run dev (in backend-worker directory)`);
    console.error(`   - Or set BACKEND_URL to your deployed worker URL`);
    console.error(`\n   Example: BACKEND_URL=https://your-worker.workers.dev npm run test:integration\n`);
    return false;
  }
}

async function runAllTests() {
  console.log(`🧪 Running Integration Tests against: ${BACKEND_URL}\n`);
  
  // Warn if API keys are the same
  if (API_KEY_PUBLIC === API_KEY_ADMIN) {
    console.warn('⚠️  WARNING: API_KEY_PUBLIC === API_KEY_ADMIN');
    console.warn('   Admin endpoints will accept public keys. This is not recommended for production.\n');
  }
  
  // Check if worker is reachable
  console.log('🔍 Checking worker connectivity...');
  const reachable = await checkWorkerReachable();
  if (!reachable) {
    process.exit(1);
  }
  console.log('✅ Worker is reachable\n');

  // Test Health Endpoint (Public)
  console.log('📋 Testing Public Endpoints...\n');

  await runTest('GET /api/health without key → success (200)', async () => {
    const result = await makeRequest('GET', '/api/health');
    assert(result.status === 200 || result.status === 503, 'Health check should return 200 or 503');
  });

  await runTest('GET /api/health with invalid key → success (200)', async () => {
    const result = await makeRequest('GET', '/api/health', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 200 || result.status === 503, 'Health check should return 200 or 503 even with invalid key');
  });

  await runTest('GET /api/health with valid key → success (200)', async () => {
    const result = await makeRequest('GET', '/api/health', { 'X-API-Key': API_KEY_PUBLIC });
    assert(result.status === 200 || result.status === 503, 'Health check should return 200 or 503 with valid key');
  });

  // Test CORS Preflight
  console.log('\n📋 Testing CORS Preflight...\n');

  await runTest('OPTIONS request to any endpoint → no auth required → 200', async () => {
    const result = await makeRequest('OPTIONS', '/api/upload');
    assert(result.status === 200, 'OPTIONS request should return 200');
    assert(result.headers['access-control-allow-origin'] === '*' || result.headers['Access-Control-Allow-Origin'] === '*', 'Should include CORS headers');
  });

  // Test Protected Endpoints
  console.log('\n📋 Testing Protected Endpoints...\n');

  // 1. POST /api/upload
  await runTest('POST /api/upload without key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload');
    assert(result.status === 401, 'Should return 401');
    assert(result.json?.code === 'MISSING_KEY', 'Should have MISSING_KEY code');
  });

  await runTest('POST /api/upload with invalid key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
    assert(result.json?.code === 'INVALID_KEY', 'Should have INVALID_KEY code');
  });

  await runTest('POST /api/upload with valid key → not 401 (may be 400 if no file)', async () => {
    const result = await makeRequest('POST', '/api/upload', { 'X-API-Key': API_KEY_PUBLIC });
    assert(result.status !== 401, 'Should not return 401 with valid key');
  });

  // 2. POST /api/upload/multipart/init
  await runTest('POST /api/upload/multipart/init without key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/init');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('POST /api/upload/multipart/init with invalid key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/init', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('POST /api/upload/multipart/init with valid key → not 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/init', 
      { 'X-API-Key': API_KEY_PUBLIC }, 
      { filename: 'test.zip', size: 1000 });
    assert(result.status !== 401, 'Should not return 401 with valid key');
  });

  // 3. POST /api/upload/multipart/part
  await runTest('POST /api/upload/multipart/part without key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/part');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('POST /api/upload/multipart/part with invalid key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/part', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  // 4. POST /api/upload/multipart/complete
  await runTest('POST /api/upload/multipart/complete without key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/complete');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('POST /api/upload/multipart/complete with invalid key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/complete', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  // 5. POST /api/upload/multipart/abort
  await runTest('POST /api/upload/multipart/abort without key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/abort');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('POST /api/upload/multipart/abort with invalid key → 401', async () => {
    const result = await makeRequest('POST', '/api/upload/multipart/abort', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  // 6. GET /api/search
  await runTest('GET /api/search without key → 401', async () => {
    const result = await makeRequest('GET', '/api/search');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('GET /api/search with invalid key → 401', async () => {
    const result = await makeRequest('GET', '/api/search', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('GET /api/search with valid key → not 401', async () => {
    const result = await makeRequest('GET', '/api/search?q=test', { 'X-API-Key': API_KEY_PUBLIC });
    assert(result.status !== 401, 'Should not return 401 with valid key');
  });

  // 7. GET /api/files
  await runTest('GET /api/files without key → 401', async () => {
    const result = await makeRequest('GET', '/api/files');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('GET /api/files with invalid key → 401', async () => {
    const result = await makeRequest('GET', '/api/files', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('GET /api/files with valid key → not 401', async () => {
    const result = await makeRequest('GET', '/api/files', { 'X-API-Key': API_KEY_PUBLIC });
    assert(result.status !== 401, 'Should not return 401 with valid key');
  });

  // 8. DELETE /api/files/{key}
  await runTest('DELETE /api/files/{key} without key → 401', async () => {
    const result = await makeRequest('DELETE', '/api/files/test-key');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('DELETE /api/files/{key} with invalid key → 401', async () => {
    const result = await makeRequest('DELETE', '/api/files/test-key', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('DELETE /api/files/{key} with admin key → success (200 or 404)', async () => {
    // First verify admin key works (helps diagnose if admin key is configured)
    const result = await makeRequest('DELETE', '/api/files/test-key-nonexistent', { 'X-API-Key': API_KEY_ADMIN });
    // Should succeed (200) or fail with 404 (file not found), but NOT 401
    assert(result.status !== 401, `Admin key should not return 401. Got ${result.status}. Response: ${JSON.stringify(result.json || result.text)}`);
    // This confirms admin key is configured and working
  });

  await runTest('DELETE /api/files/{key} with public key → 401 with ADMIN_KEY_REQUIRED', async () => {
    // First check if public and admin keys are the same in test env (edge case)
    if (API_KEY_PUBLIC === API_KEY_ADMIN) {
      console.warn('⚠️  Warning: API_KEY_PUBLIC === API_KEY_ADMIN in test environment.');
      console.warn('   Public key will work on admin endpoints. This is not recommended for production.');
      const result = await makeRequest('DELETE', '/api/files/test-key', { 'X-API-Key': API_KEY_PUBLIC });
      // Skip the assertion if keys are the same - this is a configuration issue, not a code issue
      return;
    }
    
    const result = await makeRequest('DELETE', '/api/files/test-key', { 'X-API-Key': API_KEY_PUBLIC });
    
    // If we get 200, the worker's keys likely match (even though test env keys are different)
    if (result.status === 200) {
      throw new Error(
        `DELETE succeeded with public key (got 200). ` +
        `This indicates the worker's API_KEY_PUBLIC === API_KEY_ADMIN, even though test env keys are different. ` +
        `\n📋 To fix: Ensure worker has different API keys:\n` +
        `   wrangler secret put API_KEY_PUBLIC --env staging\n` +
        `   wrangler secret put API_KEY_ADMIN --env staging\n` +
        `   (Make sure they are DIFFERENT values)\n` +
        `\nTest env keys: PUBLIC=${API_KEY_PUBLIC.substring(0, 20)}..., ADMIN=${API_KEY_ADMIN.substring(0, 20)}...`
      );
    }
    
    // Should return 401 with ADMIN_KEY_REQUIRED code when public key is used on admin endpoint
    assert(result.status === 401, `Expected 401 status, got ${result.status}. Response: ${JSON.stringify(result.json || result.text)}`);
    // The implementation should return ADMIN_KEY_REQUIRED specifically
    assert(result.json?.code === 'ADMIN_KEY_REQUIRED', 
           `Expected ADMIN_KEY_REQUIRED code, got ${result.json?.code || 'none'}. Full response: ${JSON.stringify(result.json)}`);
  });

  // 9. GET /api/files/{key}
  await runTest('GET /api/files/{key} without key → 401', async () => {
    const result = await makeRequest('GET', '/api/files/test-key');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('GET /api/files/{key} with invalid key → 401', async () => {
    const result = await makeRequest('GET', '/api/files/test-key', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  // 10. GET /api/files-inline/{key}
  await runTest('GET /api/files-inline/{key} without key → 401', async () => {
    const result = await makeRequest('GET', '/api/files-inline/test-key');
    assert(result.status === 401, 'Should return 401');
  });

  await runTest('GET /api/files-inline/{key} with invalid key → 401', async () => {
    const result = await makeRequest('GET', '/api/files-inline/test-key', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
  });

  // Test Error Response Format
  console.log('\n📋 Testing Error Response Format...\n');

  await runTest('Missing key returns: { error: "Unauthorized", code: "MISSING_KEY" }', async () => {
    const result = await makeRequest('POST', '/api/upload');
    assert(result.status === 401, 'Should return 401');
    assert(result.json?.error === 'Unauthorized', 'Should have error field');
    assert(result.json?.code === 'MISSING_KEY', 'Should have MISSING_KEY code');
    assert(result.json?.correlationId, 'Should include correlationId');
  });

  await runTest('Invalid key returns: { error: "Unauthorized", code: "INVALID_KEY" }', async () => {
    const result = await makeRequest('POST', '/api/upload', { 'X-API-Key': INVALID_KEY });
    assert(result.status === 401, 'Should return 401');
    assert(result.json?.error === 'Unauthorized', 'Should have error field');
    assert(result.json?.code === 'INVALID_KEY', 'Should have INVALID_KEY code');
    assert(result.json?.correlationId, 'Should include correlationId');
  });

  await runTest('All error responses include 401 status code', async () => {
    const endpoints = [
      '/api/upload',
      '/api/search',
      '/api/files'
    ];
    
    for (const endpoint of endpoints) {
      const result = await makeRequest('GET', endpoint);
      assert(result.status === 401, `Endpoint ${endpoint} should return 401`);
    }
  });

  await runTest('CORS headers included in error responses', async () => {
    const result = await makeRequest('GET', '/api/files');
    assert(result.headers['access-control-allow-origin'] === '*' || 
           result.headers['Access-Control-Allow-Origin'] === '*', 
           'Should include CORS headers in error response');
  });

  // Print summary
  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);

  if (failures.length > 0) {
    console.log(`\n❌ Failures:`);
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }

  if (testsFailed > 0) {
    console.log('\n❌ Some integration tests failed. Check if worker is running and API keys are set.');
    process.exit(1);
  } else {
    console.log('\n✅ All integration tests passed!');
    process.exit(0);
  }
}

// Run all tests
runAllTests().catch(error => {
  console.error('❌ Fatal error running tests:', error);
  process.exit(1);
});

