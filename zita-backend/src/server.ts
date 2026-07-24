import { buildApp } from './app';
import { config } from './config';

async function start() {
  try {
    console.log(`⏳ Building app...`);
    const app = await buildApp();
    console.log(`✅ App built successfully.`);
    
    console.log(`⏳ Starting server on port ${config.PORT}...`);
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`🚀 ZITA API running on port ${config.PORT}`);
  } catch (err) {
    console.error(`❌ Fatal error during startup:`, err);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`❌ Unhandled Rejection:`, reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`❌ Uncaught Exception:`, error);
  process.exit(1);
});

start();

