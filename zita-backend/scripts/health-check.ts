import axios from 'axios';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

async function check(name: string, url: string, expectedStatus = 200) {
  const start = Date.now();
  try {
    const res = await axios.get(url, { timeout: 5000 });
    const ok  = res.status === expectedStatus;
    console.log(`${ok ? '✅' : '❌'} ${name.padEnd(28)} ${String(Date.now() - start).padStart(6)}ms`);
    return ok;
  } catch {
    console.log(`❌ ${name.padEnd(28)} FAILED`);
    return false;
  }
}

async function main() {
  console.log(`🩺 ZITA Health Check — ${new Date().toISOString()}\n`);
  const results = await Promise.all([
    check('API Health',    `${API_URL}/health`),
    check('Books List',    `${API_URL}/api/v1/books?limit=1`),
    check('Featured',      `${API_URL}/api/v1/books/featured`),
    check('Plans',         `${API_URL}/api/v1/subscriptions/plans`),
    check('Auth (401)',    `${API_URL}/api/v1/auth/me`, 401),
  ]);
  const allOk = results.every(Boolean);
  console.log(`\n${allOk ? '✅ All systems operational' : '❌ Some checks failed'}`);
  if (!allOk) process.exit(1);
}

main();
