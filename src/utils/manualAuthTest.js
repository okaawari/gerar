// using global fetch


const BASE_URL = 'http://localhost:3000/api/auth';

async function testAuth() {
    console.log('--- Starting Manual Auth Verification ---\n');

    // 1. Register
    console.log('1. Testing Registration...');
    const regBody = {
        phoneNumber: '88888888',
        pin: '1234',
        name: 'Test User'
    };

    try {
        const regRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regBody)
        });
        const regData = await regRes.json();
        console.log(`Status: ${regRes.status}`);
        console.log('Response:', JSON.stringify(regData, null, 2));

        if (regRes.status !== 201 && regRes.status !== 409) { // 409 if already exists from previous run
            console.error('Registration Failed unexpectedly');
        }

    } catch (e) {
        console.error('Registration Error:', e.message);
    }

    console.log('\n------------------------------------------------\n');

    // 2. Login (Success)
    console.log('2. Testing Login (Valid Credentials)...');
    const loginBody = {
        phoneNumber: '88888888',
        pin: '1234'
    };

    try {
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginBody)
        });
        const loginData = await loginRes.json();
        console.log(`Status: ${loginRes.status}`);
        console.log('Response:', JSON.stringify(loginData, null, 2));

    } catch (e) {
        console.error('Login Error:', e.message);
    }

    console.log('\n------------------------------------------------\n');

    // 3. Login (Fail)
    console.log('3. Testing Login (Invalid PIN)...');
    const failBody = {
        phoneNumber: '88888888',
        pin: '0000'
    };

    try {
        const failRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(failBody)
        });
        const failData = await failRes.json();
        console.log(`Status: ${failRes.status}`);
        console.log('Response:', JSON.stringify(failData, null, 2));

    } catch (e) {
        console.error('Login Fail Error:', e.message);
    }
}

testAuth();
