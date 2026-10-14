// server/test_mobile_otp_2fa.js
// Comprehensive verification of Mobile OTP Registration, 2FA Sign-in, and Password Recovery

const API_BASE = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('========================================================');
  console.log('STARTING AUTOMATED VERIFICATION: MOBILE OTP & 2FA SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  // --- TEST 1: Ashley Super Admin Accounts Provisioning & 2FA ---
  console.log('--- 1. Testing Ashley Ghose Super Admin Accounts (28 & 64) ---');
  for (const email of ['ashleyghose64@gmail.com', 'ashleyghose28@gmail.com']) {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'Ashley@LeadPulse2026'
      })
    });

    assert(
      loginRes.status === 200 && loginRes.data?.require2fa === true,
      `Super Admin ${email} password accepted and triggers 2FA`,
      JSON.stringify(loginRes.data)
    );

    assert(
      !!loginRes.data?.tempToken && !!loginRes.data?.devOtp,
      `Super Admin ${email} received tempToken and devOtp for 2FA`,
      `tempToken: ${!!loginRes.data?.tempToken}, devOtp: ${loginRes.data?.devOtp}`
    );

    // Verify 2FA code
    const verify2faRes = await request('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({
        tempToken: loginRes.data?.tempToken,
        otp: loginRes.data?.devOtp
      })
    });

    assert(
      verify2faRes.status === 200 && !!verify2faRes.data?.token,
      `Super Admin ${email} 2FA verification succeeds and yields full session token`,
      JSON.stringify(verify2faRes.data)
    );

    assert(
      verify2faRes.data?.user?.role === 'SUPER_ADMIN' && verify2faRes.data?.user?.plan === 'pro',
      `Super Admin ${email} has SUPER_ADMIN role and pro plan`,
      `Role: ${verify2faRes.data?.user?.role}, Plan: ${verify2faRes.data?.user?.plan}`
    );
  }

  // --- TEST 2: Registration requires mobile number and OTP ---
  console.log('\n--- 2. Testing Registration Requirements ---');
  const testPhone = `+919811${Math.floor(100000 + Math.random() * 900000)}`;
  const testEmail = `newuser_${Date.now()}@leadpulse-test.io`;

  // Try registering without phone
  const failNoPhone = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'StrongPassword123!',
      name: 'Test Candidate'
    })
  });
  assert(
    failNoPhone.status === 400,
    'Registration without phone number is strictly rejected (HTTP 400)',
    JSON.stringify(failNoPhone.data)
  );

  // Send registration OTP
  const sendRegOtpRes = await request('/api/auth/send-register-otp', {
    method: 'POST',
    body: JSON.stringify({
      phone: testPhone,
      email: testEmail
    })
  });
  assert(
    sendRegOtpRes.status === 200 && sendRegOtpRes.data?.success && !!sendRegOtpRes.data?.devOtp,
    'send-register-otp returns 200 with devOtp and masked phone',
    JSON.stringify(sendRegOtpRes.data)
  );

  const regDevOtp = sendRegOtpRes.data?.devOtp;

  // Try registering with wrong OTP
  const failWrongOtp = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'StrongPassword123!',
      name: 'Test Candidate',
      phone: testPhone,
      otp: '000000'
    })
  });
  assert(
    failWrongOtp.status === 400,
    'Registration with wrong OTP code is strictly rejected (HTTP 400)',
    JSON.stringify(failWrongOtp.data)
  );

  // Register with correct OTP
  const regSuccess = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'StrongPassword123!',
      name: 'Test Candidate',
      phone: testPhone,
      otp: regDevOtp
    })
  });
  assert(
    regSuccess.status === 200 && !!regSuccess.data?.token && regSuccess.data?.user?.phone_verified === true,
    'Registration with valid mobile OTP creates account with phone_verified: true',
    JSON.stringify(regSuccess.data)
  );

  // --- TEST 3: Login with 2FA for newly registered user ---
  console.log('\n--- 3. Testing 2FA Login for Registered User ---');
  const userLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'StrongPassword123!'
    })
  });

  assert(
    userLoginRes.status === 200 && userLoginRes.data?.require2fa === true,
    'Login requires 2FA OTP for user with registered phone',
    JSON.stringify(userLoginRes.data)
  );

  const user2faRes = await request('/api/auth/verify-2fa', {
    method: 'POST',
    body: JSON.stringify({
      tempToken: userLoginRes.data?.tempToken,
      otp: userLoginRes.data?.devOtp
    })
  });

  assert(
    user2faRes.status === 200 && !!user2faRes.data?.token,
    '2FA verification completes successfully and logs in user',
    JSON.stringify(user2faRes.data)
  );

  // --- TEST 4: Forgot Password via Mobile OTP ---
  console.log('\n--- 4. Testing Forgot Password via Mobile OTP ---');
  const forgotOtpRes = await request('/api/auth/forgot-password-otp', {
    method: 'POST',
    body: JSON.stringify({
      identifier: testPhone
    })
  });

  assert(
    forgotOtpRes.status === 200 && forgotOtpRes.data?.success && !!forgotOtpRes.data?.devOtp,
    'forgot-password-otp dispatches reset OTP to registered mobile number',
    JSON.stringify(forgotOtpRes.data)
  );

  const resetOtp = forgotOtpRes.data?.devOtp;
  const newPassword = 'NewSecretPassword999!';

  // Reset password
  const resetRes = await request('/api/auth/reset-password-otp', {
    method: 'POST',
    body: JSON.stringify({
      phone: testPhone,
      otp: resetOtp,
      newPassword
    })
  });

  assert(
    resetRes.status === 200 && resetRes.data?.success && !!resetRes.data?.token,
    'reset-password-otp successfully updates password and returns active token',
    JSON.stringify(resetRes.data)
  );

  // Sign in with new password to confirm change persisted
  const loginNewPwd = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: newPassword
    })
  });

  assert(
    loginNewPwd.status === 200 && loginNewPwd.data?.require2fa === true,
    'Sign in with updated password succeeds and initiates 2FA flow',
    JSON.stringify(loginNewPwd.data)
  );

  console.log('\n========================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
