// Read-only Prisma checks using a connection supplied on stdin, never in argv.
const { spawnSync } = require('child_process');
const path = require('path');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const config = JSON.parse(input);
  const root = path.join(__dirname, '..');
  for (const args of [
    ['migrate', 'status', '--schema', 'prisma/schema.prisma'],
    ['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'],
  ]) {
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...args], {
      cwd: root, env: { ...process.env, DATABASE_URL: config.DATABASE_URL }, encoding: 'utf8', timeout: 90000,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`.replaceAll(config.DATABASE_URL, '[database URL redacted]');
    console.log(output);
    if (result.status !== 0) { process.exitCode = 1; break; }
  }
});
