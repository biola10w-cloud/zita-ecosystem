import { buildApp } from './app';
import { config } from './config';

// Catch anything that slips past try/catch blocks, e.g. rejected promises
// inside route handlers, plugins, or async code fired after listen() resolves.
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('🔥 Unhandled Promise Rejection:', reason);
  if (reason instanceof Error) {
    console.error(reason.stack);
  } else {
    console.error('Rejected promise:', promise);
  }
  // Do not exit immediately in production so we can see the log, but make sure
  // the process does not silently keep running in a broken state.
  process.exitCode = 1;
});

process.on('uncaughtException', (err: Error, origin: string) => {
  console.error(`🔥 Uncaught Exception (origin: ${origin}):`, err.message);
  console.error(err.stack);
  process.exitCode = 1;
});

async function start() {
  let app: Awaited<ReturnType<typeof buildApp>>;

  try {
    console.log('⏳ Building app (registering plugins & routes)...');
    app = await buildApp();
    console.log('✅ App built successfully.');
  } catch (err) {
    console.error('🔥 Failed to build app (buildApp threw):');
    if (err instanceof Error) {
      console.error(err.stack);
    } else {
      console.error(err);
    }
    process.exit(1);
  }

  // Extra safety net at the Fastify instance level, in case a plugin or route
  // registers something that throws outside of Fastify's own error handler.
  app.addHook('onError', async (request, reply, error) => {
    app.log.error({ err: error, url: request.url }, 'Request error caught in onError hook');
  });

  try {
    const address = await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Server listening at ${address}`);
    console.log(`🚀 ZITA API running on port ${config.PORT}`);
  } catch (err) {
    console.error('🔥 Failed to start server (app.listen threw):');
    if (err instanceof Error) {
      console.error(err.stack);
    } else {
      console.error(err);
    }
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('🔥 Unhandled error in start():');
  if (err instanceof Error) {
    console.error(err.stack);
  } else {
    console.error(err);
  }
  process.exit(1);
});
