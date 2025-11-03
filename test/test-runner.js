/**
 * Test Runner - Runs all test suites
 * 
 * Usage: node test-runner.js
 */

const { spawn } = require('child_process');
const path = require('path');

const tests = [
  { name: 'Authentication Unit Tests', file: 'test-auth.js' },
  { name: 'Tail Parser Tests', file: 'tail/test-parser.js' },
  { name: 'Code Verification Tests', file: 'test-code-verification.js' },
  { name: 'Tail Formatter Tests', file: 'test-tail-formatter.js' },
  { name: 'Query Scripts Tests', file: 'test-query-scripts.js' }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${test.name}`);
    console.log(`${'='.repeat(60)}\n`);
    
    const testPath = path.join(__dirname, test.file);
    const proc = spawn('node', [testPath], {
      stdio: 'inherit',
      shell: true
    });
    
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    
    proc.on('error', (error) => {
      console.error(`Failed to run ${test.name}: ${error.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🧪 Running All Test Suites\n');
  
  const results = [];
  
  for (const test of tests) {
    const passed = await runTest(test);
    results.push({ name: test.name, passed });
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Test Summary');
  console.log(`${'='.repeat(60)}\n`);
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });
  
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  
  console.log(`\nTotal: ${passedCount}/${results.length} test suites passed`);
  
  if (!allPassed) {
    console.log('\n❌ Some test suites failed');
    process.exit(1);
  } else {
    console.log('\n✅ All test suites passed!');
    console.log('\n💡 Note: Integration tests require a running worker.');
    console.log('   Run: node test-integration.js with BACKEND_URL and API keys set');
    process.exit(0);
  }
}

main();

