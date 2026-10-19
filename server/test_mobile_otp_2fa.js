// server/test_mobile_otp_2fa.js
// Verification of Ashley Super Admin logins with Ashley1234, Mobile OTP Registration, and Password Recovery

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
  console.log('STARTING AUTOMATED VERIFICATION SUITE');
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

  // --- TEST 1: Ashley Super Admin & Bicon Ghose User Account ---
  console.log('--- 1. Testing Ashley (SUPER_ADMIN) & Bicon Ghose (USER) Accounts ---');
  
  // 1a. Ashley Super Admin
  const ashleyRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'ashleyghose64@gmail.com',
      password: 'Maybach@$#051995'
    })
  });

  assert(
    ashleyRes.status === 200 && !!ashleyRes.data?.token,
    'Super Admin ashleyghose64@gmail.com logs in directly with Maybach@$#051995',
    JSON.stringify(ashleyRes.data)
  );

  assert(
    ashleyRes.data?.user?.role === 'SUPER_ADMIN' && ashleyRes.data?.user?.plan === 'pro',
    'Super Admin ashleyghose64@gmail.com has role SUPER_ADMIN and plan pro',
    `Role: ${ashleyRes.data?.user?.role}, Plan: ${ashleyRes.data?.user?.plan}`
  );

  assert(
    ashleyRes.data?.user?.name === 'Ashley',
    'Super Admin ashleyghose64@gmail.com has name Ashley',
    `Name: ${ashleyRes.data?.user?.name}`
  );

  // 1b. Bicon Ghose User Account
  const biconRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'ashleyghose28@gmail.com',
      password: 'Ashley1234'
    })
  });

  assert(
    biconRes.status === 200 && !!biconRes.data?.token,
    'User ashleyghose28@gmail.com logs in directly with Ashley1234',
    JSON.stringify(biconRes.data)
  );

  assert(
    biconRes.data?.user?.role === 'USER' && biconRes.data?.user?.plan === 'free',
    'Account ashleyghose28@gmail.com has role USER and plan free',
    `Role: ${biconRes.data?.user?.role}, Plan: ${biconRes.data?.user?.plan}`
  );

  assert(
    biconRes.data?.user?.name === 'Bicon Ghose',
    'Account ashleyghose28@gmail.com has name Bicon Ghose',
    `Name: ${biconRes.data?.user?.name}`
  );

  // --- TEST 2: Registration requires mobile number and OTP ---
  console.log('\n--- 2. Testing Registration Requirements ---');
  const testPhone = `+919811${Math.floor(100000 + Math.random() * 900000)}`;
  const testEmail = `newuser_${Date.now()}@strovr-test.io`;

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

  // --- TEST 3: Login for newly registered user ---
  console.log('\n--- 3. Testing Direct Login for Registered User ---');
  const userLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'StrongPassword123!'
    })
  });

  assert(
    userLoginRes.status === 200 && !!userLoginRes.data?.token,
    'Login authenticates directly without 2FA challenge',
    JSON.stringify(userLoginRes.data)
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
    loginNewPwd.status === 200 && !!loginNewPwd.data?.token,
    'Sign in with updated password succeeds directly',
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
