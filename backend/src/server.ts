import { buildApp } from './app';
import { config } from './config';
import { initSentry, captureException } from './shared/monitoring/sentry';

initSentry();

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    console.log(`ðŸš€ ZITA API running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    captureException(err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  captureException(reason);
  console.error('Unhandled rejection:', reason);
});

start();
