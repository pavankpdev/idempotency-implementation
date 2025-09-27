#!/usr/bin/env node

// Comprehensive integration test for frontend-backend communication
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🧪 Starting comprehensive integration test...');

// Start the server
const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    stdio: 'pipe',
    detached: false
});

let serverReady = false;
let serverOutput = '';

serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    console.log('📤 Server:', output.trim());
    
    if (output.includes('Server is running on port')) {
        serverReady = true;
    }
});

serverProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.log('📥 Server Error:', error.trim());
});

serverProcess.on('error', (error) => {
    console.error('💥 Server process error:', error);
});

// Wait for server to start
console.log('⏳ Waiting for server to start...');
let attempts = 0;
while (!serverReady && attempts < 10) {
    await setTimeout(1000);
    attempts++;
}

if (!serverReady) {
    console.error('❌ Server failed to start within 10 seconds');
    serverProcess.kill('SIGTERM');
    process.exit(1);
}

console.log('✅ Server is ready, starting tests...');

// Test functions
async function testBalanceEndpoint() {
    console.log('\n📊 Testing GET /balance endpoint...');
    
    try {
        const response = await fetch('http://localhost:3000/balance');
        
        if (response.ok) {
            const balances = await response.json();
            console.log(`✅ GET /balance successful: ${balances.length} users found`);
            console.log('📋 Sample user:', balances[0]);
            return balances;
        } else {
            console.log(`❌ GET /balance failed: ${response.status} ${response.statusText}`);
            return null;
        }
    } catch (error) {
        console.error('❌ GET /balance error:', error.message);
        return null;
    }
}

async function testFrontendAccess() {
    console.log('\n🌐 Testing frontend access...');
    
    try {
        const response = await fetch('http://localhost:3000/');
        
        if (response.ok) {
            const html = await response.text();
            const hasTitle = html.includes('Stop Double Charges');
            const hasScript = html.includes('fetchBalances');
            
            console.log(`✅ Frontend accessible: ${response.status}`);
            console.log(`📄 Has correct title: ${hasTitle}`);
            console.log(`🔧 Has JavaScript: ${hasScript}`);
            return true;
        } else {
            console.log(`❌ Frontend access failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Frontend access error:', error.message);
        return false;
    }
}

async function testUnsafePayment(balances) {
    console.log('\n⚠️  Testing unsafe payment flow...');
    
    if (!balances || balances.length < 2) {
        console.log('❌ Cannot test - insufficient balance data');
        return false;
    }
    
    const payload = {
        senderEmail: balances[0].email,
        recipientEmail: balances[1].email,
        amount: 5.00
    };
    
    console.log(`💸 Testing payment: ${payload.senderEmail} → ${payload.recipientEmail} ($${payload.amount})`);
    
    let attempts = 0;
    let success = false;
    
    while (attempts < 5 && !success) {
        try {
            attempts++;
            console.log(`🔄 Attempt ${attempts}/5`);
            
            const response = await fetch('http://localhost:3000/unsafe-pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (response.status === 503) {
                console.log(`⏳ Service unavailable (expected), retrying...`);
                const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
                await setTimeout(retryAfter * 1000);
            } else if (response.status === 201) {
                console.log(`✅ Payment successful after ${attempts} attempts`);
                console.log('📋 Result:', data);
                success = true;
            } else {
                console.log(`❌ Unexpected response: ${response.status}`, data);
                break;
            }
        } catch (error) {
            console.error(`❌ Attempt ${attempts} failed:`, error.message);
        }
    }
    
    return success;
}

async function testSafePayment(balances) {
    console.log('\n🛡️  Testing safe payment flow...');
    
    if (!balances || balances.length < 2) {
        console.log('❌ Cannot test - insufficient balance data');
        return false;
    }
    
    const payload = {
        senderEmail: balances[0].email,
        recipientEmail: balances[1].email,
        amount: 3.00,
        idempotencyKey: 'test-key-' + Date.now()
    };
    
    console.log(`💸 Testing safe payment: ${payload.senderEmail} → ${payload.recipientEmail} ($${payload.amount})`);
    console.log(`🔑 Idempotency key: ${payload.idempotencyKey}`);
    
    let attempts = 0;
    let success = false;
    
    while (attempts < 5 && !success) {
        try {
            attempts++;
            console.log(`🔄 Attempt ${attempts}/5`);
            
            const response = await fetch('http://localhost:3000/safe-pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (response.status === 503) {
                console.log(`⏳ Service unavailable (expected), retrying...`);
                const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
                await setTimeout(retryAfter * 1000);
            } else if (response.status === 201) {
                console.log(`✅ Safe payment successful after ${attempts} attempts`);
                console.log('📋 Result:', data);
                success = true;
            } else {
                console.log(`❌ Unexpected response: ${response.status}`, data);
                break;
            }
        } catch (error) {
            console.error(`❌ Attempt ${attempts} failed:`, error.message);
        }
    }
    
    return success;
}

async function testParallelSafePayment(balances) {
    console.log('\n🔄 Testing parallel safe payment flow...');
    
    if (!balances || balances.length < 2) {
        console.log('❌ Cannot test - insufficient balance data');
        return false;
    }
    
    const payload = {
        senderEmail: balances[0].email,
        recipientEmail: balances[1].email,
        amount: 2.00,
        idempotencyKey: 'parallel-test-' + Date.now()
    };
    
    console.log(`💸 Testing 5 parallel requests with same idempotency key`);
    console.log(`🔑 Idempotency key: ${payload.idempotencyKey}`);
    
    try {
        // Make 5 parallel requests
        const promises = Array(5).fill().map(async (_, i) => {
            console.log(`🚀 Starting parallel request ${i + 1}/5`);
            
            let attempts = 0;
            while (attempts < 5) {
                try {
                    attempts++;
                    const response = await fetch('http://localhost:3000/safe-pay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    const data = await response.json();
                    
                    if (response.status === 503) {
                        const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
                        await setTimeout(retryAfter * 1000);
                    } else if (response.status === 201) {
                        return { success: true, transferId: data.transferId, requestId: i + 1 };
                    } else {
                        return { success: false, status: response.status, requestId: i + 1 };
                    }
                } catch (error) {
                    if (attempts >= 5) {
                        return { success: false, error: error.message, requestId: i + 1 };
                    }
                }
            }
            return { success: false, error: 'Max attempts reached', requestId: i + 1 };
        });
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => r.success);
        const transferIds = successful.map(r => r.transferId);
        const uniqueTransferIds = [...new Set(transferIds)];
        
        console.log(`📊 Results: ${successful.length}/5 requests successful`);
        console.log(`🎯 Unique transfer IDs: ${uniqueTransferIds.length} (should be 1)`);
        
        if (uniqueTransferIds.length === 1) {
            console.log('✅ Parallel safe payment test passed - all requests converged to same transfer');
            return true;
        } else {
            console.log('❌ Parallel safe payment test failed - multiple transfers created');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Parallel test error:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    const results = {
        balance: false,
        frontend: false,
        unsafe: false,
        safe: false,
        parallel: false
    };
    
    // Test balance endpoint
    const balances = await testBalanceEndpoint();
    results.balance = balances !== null;
    
    // Test frontend access
    results.frontend = await testFrontendAccess();
    
    // Test payment flows
    if (balances) {
        results.unsafe = await testUnsafePayment(balances);
        results.safe = await testSafePayment(balances);
        results.parallel = await testParallelSafePayment(balances);
    }
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log(`📊 Balance endpoint: ${results.balance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🌐 Frontend access: ${results.frontend ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`⚠️  Unsafe payment: ${results.unsafe ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🛡️  Safe payment: ${results.safe ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔄 Parallel safe: ${results.parallel ? '✅ PASS' : '❌ FAIL'}`);
    
    const passCount = Object.values(results).filter(Boolean).length;
    console.log(`\n🎯 Overall: ${passCount}/5 tests passed`);
    
    return results;
}

// Execute tests
const testResults = await runAllTests();

// Clean up
console.log('\n🧹 Cleaning up...');
serverProcess.kill('SIGTERM');

// Wait for cleanup
await setTimeout(1000);

console.log('✅ Integration test completed');

// Exit with appropriate code
const allPassed = Object.values(testResults).every(Boolean);
process.exit(allPassed ? 0 : 1);