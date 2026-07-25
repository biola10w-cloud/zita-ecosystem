import { buildApp } from './app';

async function start() {
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
