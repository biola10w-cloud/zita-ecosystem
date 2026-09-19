// Controlled production smoke test. Variables arrive over stdin; secrets stay in memory.
// Creates only a uniquely named temporary admin and unpublished draft, then removes them.
const { PrismaClient } = require('@prisma/client');
const { S3Client, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');
const Bull = require('bull');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = check => console.log(JSON.stringify({ check, ok: true }));
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  const vars = JSON.parse(input);
  const db = new PrismaClient({ datasources: { db: { url: vars.DIAGNOSTIC_DATABASE_URL } } });
  const aws = { region: vars.AWS_REGION, credentials: {
    accessKeyId: vars.AWS_ACCESS_KEY_ID, secretAccessKey: vars.AWS_SECRET_ACCESS_KEY,
  } };
  const s3 = new S3Client({ ...aws, ...(vars.S3_ENDPOINT ? { endpoint: vars.S3_ENDPOINT } : {}) });
  const kms = new KMSClient(aws);
  const queue = new Bull('encryption', vars.DIAGNOSTIC_REDIS_URL);
  queue.on('error', () => {});
  const suffix = crypto.randomUUID();
  const title = `Zita private upload check ${suffix}`;
  const email = `zita-check-${suffix}@example.invalid`;
  const password = crypto.randomBytes(32).toString('base64url');
  const api = 'https://zita-ecosystem-production.up.railway.app/api/v1';
  const admin = 'https://zita-admin-production.up.railway.app';
  const bodyText = 'This temporary draft checks the Zita encryption pipeline.\nIts first line must remain intact.';
  const cover = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5X8AAAAASUVORK5CYII=', 'base64');
  let user, book, job, rawKey;
  const fetchWithTimeout = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  try {
    user = await db.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), displayName: 'Temporary upload check', role: 'ADMIN' } });
    const login = await fetchWithTimeout(`${admin}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200, 'Admin login must succeed');
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const token = cookie.split('; ').find(value => value.startsWith('zita_admin_session='))?.split('=')[1];
    assert.ok(token, 'Admin session cookie must be present');
    report('Admin login through deployed panel');
    const form = new FormData();
    form.append('metadata', JSON.stringify({ title, authorName: 'Zita test', description: 'Temporary unpublished upload check', contentType: 'BOOK', language: 'en', estimatedMinutes: 1, isPremium: false, tags: [] }));
    form.append('content', new Blob([bodyText], { type: 'text/plain' }), 'check.txt');
    form.append('cover', new Blob([cover], { type: 'image/png' }), 'check.png');
    const upload = await fetchWithTimeout(`${admin}/api/books`, { method: 'POST', headers: { Cookie: cookie }, body: form });
    assert.equal(upload.status, 202, 'Draft upload must be accepted');
    const result = await upload.json();
    book = result.data.book;
    job = await queue.getJob(result.data.encryptionJobId);
    assert.ok(job, 'Encryption job must be present');
    rawKey = job.data.rawS3Key;
    report('Private source and cover upload accepted');
    for (let attempt = 0; attempt < 45; attempt++) {
      const state = await job.getState();
      if (state === 'completed') break;
      assert.notEqual(state, 'failed', 'Encryption worker must complete');
      if (attempt % 5 === 0) console.log(JSON.stringify({ check: 'Encryption worker', state }));
      await sleep(2000);
    }
    assert.equal(await job.getState(), 'completed', 'Encryption job must finish within 90 seconds');
    book = await db.book.findUniqueOrThrow({ where: { id: book.id }, include: { chapters: true } });
    assert.equal(book.isPublished, false);
    assert.equal(book.totalChapters, 1);
    assert.equal(book.chapters.length, 1);
    report('Worker completed encrypted draft');
    const chapter = book.chapters[0];
    const stored = await s3.send(new GetObjectCommand({ Bucket: vars.S3_BUCKET_NAME, Key: chapter.encryptedKey }));
    const encrypted = Buffer.from(await stored.Body.transformToByteArray());
    assert.notEqual(encrypted.toString('utf8'), bodyText);
    const unwrapped = await kms.send(new DecryptCommand({ KeyId: vars.KMS_KEY_ARN, CiphertextBlob: Buffer.from(book.encryptedFileKey, 'base64'), EncryptionAlgorithm: 'SYMMETRIC_DEFAULT' }));
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(unwrapped.Plaintext), Buffer.from(chapter.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(chapter.authTag, 'hex'));
    assert.equal(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'), bodyText);
    report('KMS unwrap and authenticated decryption preserve all text');
    try {
      await s3.send(new HeadObjectCommand({ Bucket: vars.S3_BUCKET_NAME, Key: rawKey }));
      throw new Error('Temporary source still exists');
    } catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
    report('Temporary plaintext source removed');
    const image = await fetchWithTimeout(book.coverUrl);
    assert.equal(image.status, 200, 'Cover URL must work');
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), cover);
    report('Public cover URL returns the uploaded image');
    if (!vars.S3_ENDPOINT) {
      const unsigned = await fetchWithTimeout(`https://${vars.S3_BUCKET_NAME}.s3.${vars.AWS_REGION}.amazonaws.com/${chapter.encryptedKey}`);
      assert.equal(unsigned.status, 403, 'Book objects must not be publicly downloadable');
      report('Unsigned access to stored chapter is denied');
    }
    assert.equal((await fetchWithTimeout(`${api}/books/${book.slug}`)).status, 404);
    assert.equal((await fetchWithTimeout(`${api}/books/${book.slug}/chapters/0/content`, { headers: { Authorization: `Bearer ${decodeURIComponent(token)}` } })).status, 403);
    report('Unpublished book metadata and reader content are inaccessible');
  } catch (error) {
    console.log(JSON.stringify({ check: 'Draft upload smoke test', ok: false, error: error.name, ...(error.code === 'ERR_ASSERTION' ? { message: error.message } : {}), status: error.$metadata?.httpStatusCode }));
    process.exitCode = 1;
  } finally {
    try {
      // Recover only this run's uniquely named draft if the HTTP response was lost.
      book = await db.book.findFirst({ where: { title, authorName: 'Zita test' }, include: { chapters: true } });
      if (book && !job) {
        const jobs = await queue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed', 'paused']);
        job = jobs.find(candidate => candidate.data.bookId === book.id);
        rawKey = job?.data.rawS3Key;
      }
      if (job && await job.getState() === 'active') {
        for (let attempt = 0; attempt < 45 && await job.getState() === 'active'; attempt++) await sleep(2000);
      }
      if (job) await job.remove(); // Refuses to remove an active worker job.
      if (book) {
        book = await db.book.findUniqueOrThrow({ where: { id: book.id }, include: { chapters: true } });
      }
      // Prefixes contain this run's random UUID, so cleanup cannot touch real books.
      const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const ownedKeys = new Set([...(book?.chapters.map(chapter => chapter.encryptedKey) ?? []), ...(rawKey ? [rawKey] : [])]);
      for (const prefix of [`temp/normalized/${baseSlug}-`, `public/covers/${baseSlug}-`, ...(book ? [`books/${book.id}/chapters/`] : [])]) {
        const objects = await s3.send(new ListObjectsV2Command({ Bucket: vars.S3_BUCKET_NAME, Prefix: prefix }));
        for (const object of objects.Contents ?? []) ownedKeys.add(object.Key);
      }
      for (const key of ownedKeys) {
        await s3.send(new DeleteObjectCommand({ Bucket: vars.S3_BUCKET_NAME, Key: key }));
      }
      if (book) {
        await db.book.delete({ where: { id: book.id } });
      }
      if (user) await db.user.delete({ where: { id: user.id } });
      report('Temporary draft, objects, queue job, and test account removed');
    } catch (error) {
      console.log(JSON.stringify({ check: 'Cleanup needs attention', ok: false, error: error.name, bookId: book?.id, userId: user?.id }));
      process.exitCode = 1;
    }
    await queue.close();
    await db.$disconnect();
    s3.destroy(); kms.destroy();
  }
});
