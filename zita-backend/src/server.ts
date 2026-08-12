import { buildApp } from './app';
import { runSeed } from './shared/db/seed';

async function start() {
  try {
    // Run seed on startup (idempotent - only creates admin if doesn't exist)
    console.log('🌱 Checking database seed...');
    await runSeed();
    console.log('✓ Seed check complete');
  } catch (seedError) {
    console.warn('⚠️ Seed warning:', seedError);
    // Don't fail startup if seed fails - app should still run
  }

  const app = await buildApp();
  try {
    // Railway injects PORT dynamically — never hardcode it.
    // Using process.env.PORT directly bypasses any config layer.
    const PORT = Number(process.env.PORT) || 3000;
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 ZITA API running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

