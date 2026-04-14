
const API_URL = 'http://localhost:5001';

async function runTest() {
    try {
        console.log("1. Logging in...");
        const loginRes = await fetch(`${API_URL}/auth/mock-social-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'Google',
                email: `test_walker_${Date.now()}@example.com`
            })
        });

        if (!loginRes.ok) throw new Error(await loginRes.text());
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log("   Logged in as:", loginData.user.name, "(Role:", loginData.role + ")");

        if (loginData.role !== 'FIELD') {
            console.log("   User is not FIELD. Creating new FIELD user...");
            const email = `field_officer_${Date.now()}@test.com`;
            const signupRes = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: "Test Walker",
                    phone: `999${Date.now().toString().slice(-7)}`,
                    email: email,
                    password: "password123",
                    role: "FIELD"
                })
            });

            if (!signupRes.ok) throw new Error(await signupRes.text());
            console.log("   Signed up FIELD user. Logging in...");

            const loginRes2 = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: "password123" })
            });
            const loginData2 = await loginRes2.json();
            await runTracking(loginData2.token);
        } else {
            await runTracking(token);
        }

    } catch (err) {
        console.error("Test failed:", err.message);
    }
}

async function runTracking(token) {
    console.log("2. Starting Day (Attendance)...");
    const startRes = await fetch(`${API_URL}/field/attendance/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            location: { lat: 12.9716, lng: 77.5946, address: "Start Point" },
            odometer: 1000
        })
    });

    // It might fail if already started, which is fine
    // But we need to make sure we have an active attendance
    const startData = await startRes.json();
    console.log("   Start Day Response:", startRes.status, startData.error || "Success");

    console.log("3. Simulation: Walking...");
    // Move 0.0002 degrees approx 22 meters
    let lat = 12.9716;
    let lng = 77.5946;

    for (let i = 1; i <= 5; i++) {
        lat += 0.0002;

        // Wait 1 sec
        await new Promise(r => setTimeout(r, 1000));

        console.log(`   Step ${i}: Moving to ${lat.toFixed(4)}, ${lng.toFixed(4)}...`);
        const trackRes = await fetch(`${API_URL}/field/location/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                lat, lng, accuracy: 10, address: "Moving...", activity: "WALKING"
            })
        });

        const trackData = await trackRes.json();
        console.log(`   Response: TotalDist=${trackData.totalDistance?.toFixed(4)} km`);
    }
}

runTest();
