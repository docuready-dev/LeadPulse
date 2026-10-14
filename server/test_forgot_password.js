const assert = require('assert');

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL = `pwd_reset_test_${Date.now()}@testpulse.org`;
const INITIAL_PWD = 'FirstPassword123!';
const NEW_PWD = 'BrandNewPassword456!';

async function postJson(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, ok: res.ok, data: json };
}

async function runTestSuite() {
  console.log('--- Starting Forgot Password & Verification Link Test Suite ---');
  let testsPassed = 0;

  // 1. Register test user
  console.log(`[1] Registering test user: ${TEST_EMAIL}`);
  const regRes = await postJson(`${BASE_URL}/api/auth/register`, {
    email: TEST_EMAIL,
    password: INITIAL_PWD,
    name: 'Forgot Pass Tester'
  });
  assert.strictEqual(regRes.status, 200, 'Registration status should be 200');
  assert.ok(regRes.data.token, 'Should receive JWT token on registration');
  testsPassed++;
  console.log('   Pass: User registered successfully.');

  // 2. Verify initial login works
  console.log('[2] Verifying initial login with initial password');
  const loginRes = await postJson(`${BASE_URL}/api/auth/login`, {
    email: TEST_EMAIL,
    password: INITIAL_PWD
  });
  assert.strictEqual(loginRes.status, 200, 'Login status should be 200');
  assert.ok(loginRes.data.token, 'Login should return token');
  testsPassed++;
  console.log('   Pass: Initial login validated.');

  // 3. Request password reset verification link
  console.log('[3] Requesting forgot-password verification link');
  const forgotRes = await postJson(`${BASE_URL}/api/auth/forgot-password`, {
    email: TEST_EMAIL
  });
  assert.strictEqual(forgotRes.status, 200, 'Forgot password status should be 200');
  assert.strictEqual(forgotRes.data.success, true, 'Should indicate success');
  assert.ok(forgotRes.data.previewUrl, 'Should provide previewUrl in non-production environment');
  
  const resetUrl = new URL(forgotRes.data.previewUrl);
  const token = resetUrl.searchParams.get('token');
  const emailParam = resetUrl.searchParams.get('email');
  
  assert.ok(token && token.length === 64, `Reset token should be 64-char hex, got: ${token}`);
  assert.strictEqual(emailParam.toLowerCase(), TEST_EMAIL.toLowerCase(), 'Email param in link matches');
  testsPassed++;
  console.log(`   Pass: Verification link generated: ${forgotRes.data.previewUrl}`);

  // 4. Test verify-reset-token with valid token
  console.log('[4] Testing verify-reset-token with valid token');
  const verifyRes = await postJson(`${BASE_URL}/api/auth/verify-reset-token`, {
    email: TEST_EMAIL,
    token: token
  });
  assert.strictEqual(verifyRes.status, 200, 'Verify token status should be 200');
  assert.strictEqual(verifyRes.data.valid, true, 'Token should be marked valid');
  testsPassed++;
  console.log('   Pass: Valid token accepted.');

  // 5. Test verify-reset-token with invalid token
  console.log('[5] Testing verify-reset-token with invalid token');
  const fakeVerifyRes = await postJson(`${BASE_URL}/api/auth/verify-reset-token`, {
    email: TEST_EMAIL,
    token: 'fake_tampered_token_xyz_123'
  });
  assert.strictEqual(fakeVerifyRes.status, 400, 'Fake token should return 400');
  assert.strictEqual(fakeVerifyRes.data.valid, false, 'Valid flag should be false');
  testsPassed++;
  console.log('   Pass: Invalid token rejected as expected.');

  // 6. Test reset-password with short password (< 6 chars)
  console.log('[6] Testing reset-password with invalid password (< 6 chars)');
  const shortPassRes = await postJson(`${BASE_URL}/api/auth/reset-password`, {
    email: TEST_EMAIL,
    token: token,
    newPassword: '123'
  });
  assert.strictEqual(shortPassRes.status, 400, 'Short password should return 400');
  testsPassed++;
  console.log('   Pass: Short password rejected.');

  // 7. Test reset-password with valid new password
  console.log('[7] Executing reset-password with valid new password');
  const resetPassRes = await postJson(`${BASE_URL}/api/auth/reset-password`, {
    email: TEST_EMAIL,
    token: token,
    newPassword: NEW_PWD
  });
  assert.strictEqual(resetPassRes.status, 200, 'Reset password status should be 200');
  assert.strictEqual(resetPassRes.data.success, true, 'Reset should be successful');
  assert.ok(resetPassRes.data.token, 'Should return authenticated session token');
  assert.strictEqual(resetPassRes.data.user.email, TEST_EMAIL, 'Returned user email matches');
  testsPassed++;
  console.log('   Pass: Password updated and user auto-authenticated.');

  // 8. Verify token replay attack is blocked (token wiped)
  console.log('[8] Testing token reuse / replay prevention');
  const reuseRes = await postJson(`${BASE_URL}/api/auth/reset-password`, {
    email: TEST_EMAIL,
    token: token,
    newPassword: 'AnotherPassword999!'
  });
  assert.strictEqual(reuseRes.status, 400, 'Reused token should return 400');
  testsPassed++;
  console.log('   Pass: Replay attack blocked (token single-use only).');

  // 9. Verify old password no longer authenticates
  console.log('[9] Verifying sign-in with OLD password fails');
  const oldLoginRes = await postJson(`${BASE_URL}/api/auth/login`, {
    email: TEST_EMAIL,
    password: INITIAL_PWD
  });
  assert.strictEqual(oldLoginRes.status, 400, 'Old password login should return 400');
  testsPassed++;
  console.log('   Pass: Old password rejected as expected.');

  // 10. Verify sign-in with NEW password succeeds
  console.log('[10] Verifying sign-in with NEW password succeeds');
  const newLoginRes = await postJson(`${BASE_URL}/api/auth/login`, {
    email: TEST_EMAIL,
    password: NEW_PWD
  });
  assert.strictEqual(newLoginRes.status, 200, 'New password login should be 200');
  assert.ok(newLoginRes.data.token, 'New password login returned session token');
  testsPassed++;
  console.log('   Pass: New password authenticates successfully.');

  // 11. Verify frontend Vite preview serves /reset-password
  console.log('[11] Verifying frontend /reset-password page is served');
  const viteRes = await fetch('http://localhost:5173/reset-password');
  assert.strictEqual(viteRes.status, 200, 'Vite preview should return 200');
  const html = await viteRes.text();
  assert.ok(html.includes('id="root"'), 'Should return HTML containing root element');
  testsPassed++;
  console.log('   Pass: Frontend route /reset-password successfully served.');

  console.log(`\nALL ${testsPassed}/${testsPassed} FORGOT PASSWORD VERIFICATION TESTS PASSED!\n`);
}

runTestSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err.message);
  process.exit(1);
});
