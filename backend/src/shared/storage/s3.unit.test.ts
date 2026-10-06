import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ send: vi.fn(), config: {
  AWS_REGION: 'eu-west-1', AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test',
  S3_BUCKET_NAME: 'test', API_BASE_URL: 'https://api.example.com/api/v1/', CDN_BASE_URL: '',
} }));
vi.mock('../../config', () => ({ config: mocks.config }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = mocks.send; },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class {}, DeleteObjectCommand: class { constructor(public input: unknown) {} },
  ListObjectsV2Command: class { constructor(public input: unknown) {} },
}));
import { S3Service } from './s3';
const png = Buffer.from('89504e470d0a1a0a', 'hex');
beforeEach(() => { vi.clearAllMocks(); mocks.config.CDN_BASE_URL = ''; });
it('uses the API cover route when no CDN is configured', async () => {
  expect(await S3Service.uploadPublicAsset('covers/book-123', png, 'image/png'))
    .toBe('https://api.example.com/api/v1/assets/covers/book-123');
  expect(mocks.send.mock.calls[0][0].input.Key).toBe('public/covers/book-123');
});
it('uses an explicitly configured CDN', async () => {
  mocks.config.CDN_BASE_URL = 'https://cdn.example.com/';
  expect(await S3Service.uploadPublicAsset('covers/book', png, 'image/png'))
    .toBe('https://cdn.example.com/public/covers/book');
});
it('rejects mislabeled active content before uploading', async () => {
  await expect(S3Service.uploadPublicAsset('covers/book', Buffer.from('<svg/>'), 'image/png'))
    .rejects.toMatchObject({ statusCode: 415 });
  expect(mocks.send).not.toHaveBeenCalled();
});

it('cleans only the deleted book, including every page of objects', async () => {
  mocks.send.mockImplementation(async (command) => {
    if (command.input.Prefix === 'books/book-1/' && !command.input.ContinuationToken) return {
      Contents: [{ Key: 'books/book-1/chapters/0.enc' }], IsTruncated: true, NextContinuationToken: 'next',
    };
    if (command.input.Prefix === 'books/book-1/') return { Contents: [{ Key: 'books/book-1/audio/en/0.enc' }] };
    if (command.input.Prefix === 'temp/normalized/my-book-') return { Contents: [
      { Key: 'temp/normalized/my-book-123456.txt' },
      { Key: 'temp/normalized/my-book-another-slug-123456.txt' },
    ] };
    return {};
  });
  await S3Service.deleteBookAssets('book-1', 'my-book');
  expect(mocks.send.mock.calls.map(([command]) => command.input.Key).filter(Boolean)).toEqual([
    'books/book-1/chapters/0.enc', 'books/book-1/audio/en/0.enc',
    'temp/normalized/my-book-123456.txt', 'public/covers/my-book',
  ]);
});

it('rejects unsafe storage paths before deleting anything', async () => {
  await expect(S3Service.deleteBookAssets('../other', 'book')).rejects.toThrow();
  expect(mocks.send).not.toHaveBeenCalled();
});
