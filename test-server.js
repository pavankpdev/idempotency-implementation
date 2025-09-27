#!/usr/bin/env node

// Simple test script to validate server functionality
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🧪 Starting server integration test...');

// Start the server
const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    stdio: 'pipe',
    detached: false
});

let serverOutput = '';
let serverError = '';

serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    console.log('📤 Server stdout:', output.trim());
});

serverProcess.stderr.on('data', (data) => {
    const error = data.toString();
    serverError += error;
    console.log('📥 Server stderr:', error.trim());
});

serverProcess.on('error', (error) => {
    console.error('💥 Server process error:', error);
});

// Wait for server to start
await setTimeout(3000);

// Test the endpoints
async function testEndpoints() {
    console.log('\n🔍 Testing endpoints...');
    
    try {
        // Test GET /balance
        console.log('📊 Testing GET /balance...');
        const balanceResponse = await fetch('http://localhost:3000/balance');
        
        if (balanceResponse.ok) {
            const balances = await balanceResponse.json();
            console.log('✅ GET /balance successful:', balances.length, 'users found');
        } else {
            console.log('❌ GET /balance failed:', balanceResponse.status, balanceResponse.statusText);
        }
        
        // Test POST /unsafe-pay
        console.log('⚠️  Testing POST /unsafe-pay...');
        const unsafePayload = {
            senderEmail: 'amathevon0@blog.com',
            recipientEmail: 'dchalk1@vimeo.com',
            amount: 10.00
        };
        
        const unsafeResponse = await fetch('http://localhost:3000/unsafe-pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(unsafePayload)
        });
        
        console.log('📤 Unsafe pay response:', unsafeResponse.status, unsafeResponse.statusText);
        
        // Test POST /safe-pay
        console.log('🛡️  Testing POST /safe-pay...');
        const safePayload = {
            ...unsafePayload,
            idempotencyKey: 'test-key-' + Date.now()
        };
        
        const safeResponse = await fetch('http://localhost:3000/safe-pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(safePayload)
        });
        
        console.log('📤 Safe pay response:', safeResponse.status, safeResponse.statusText);
        
    } catch (error) {
        console.error('❌ Endpoint test failed:', error.message);
    }
}

// Run tests
await testEndpoints();

// Clean up
console.log('\n🧹 Cleaning up...');
serverProcess.kill('SIGTERM');

console.log('✅ Test completed');