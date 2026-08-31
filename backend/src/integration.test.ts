import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import axios from 'axios';
import { prisma } from './shared/db/prisma';
import { AuthService } from './modules/auth/auth.service';

// These tests hit a live running instance of the backend server.
// Skipped by default; set RUN_INTEGRATION=true and API_BASE_URL to enable
// (the server must already be running, e.g. `npm run dev`).
const runIntegration = process.env.RUN_INTEGRATION === 'true';
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';
const client = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

describe.skipIf(!runIntegration)('Integration Tests - API Endpoints', () => {
  let userToken: string;
  let userId: string;
  let user2Token: string;
  let userId2: string;
  let bookSlug: string;

  beforeEach(async () => {
    const reg1 = await AuthService.register(
      `it-${Date.now()}-${Math.random()}@example.com`,
      'Password123!',
      'Integration Test User',
      `device-${Date.now()}`,
      'WEB'
    );
    userId = reg1.user.id;
    userToken = reg1.tokens.accessToken;

    const reg2 = await AuthService.register(
      `it2-${Date.now()}-${Math.random()}@example.com`,
      'Password123!',
      'Integration Test User 2',
      `device2-${Date.now()}`,
      'WEB'
    );
    userId2 = reg2.user.id;
    user2Token = reg2.tokens.accessToken;

    const book = await prisma.book.create({
      data: {
        title: 'Integration Test Book',
        slug: `it-book-${Date.now()}-${Math.random()}`,
        authorName: 'Test Author',
        description: 'Testing API endpoints',
        language: 'en',
        isPremium: false,
        isPublished: true,
        publishedAt: new Date(),
        totalChapters: 5,
      },
    });
    bookSlug = book.slug;
  });

  afterAll(async () => {
    await prisma.readingProgress.deleteMany();
    await prisma.highlight.deleteMany();
    await prisma.commentLike.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.report.deleteMany();
    await prisma.bookLike.deleteMany();
    await prisma.book.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Auth Endpoints', () => {
    it('GET /auth/me - should return authenticated user profile', async () => {
      const response = await client.get('/auth/me', {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data.data.id).toBe(userId);
    });

    it('GET /auth/me - should reject without token', async () => {
      const response = await client.get('/auth/me');
      expect(response.status).toBe(401);
    });
  });

  describe('Books Endpoints', () => {
    it('GET /books - should list books with pagination', async () => {
      const response = await client.get('/books?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.meta.pagination).toBeDefined();
    });

    it('GET /books/:slug - should retrieve book by slug', async () => {
      const response = await client.get(`/books/${bookSlug}`);

      expect(response.status).toBe(200);
      expect(response.data.data.slug).toBe(bookSlug);
    });

    it('GET /books/:slug - should return 404 for non-existent book', async () => {
      const response = await client.get('/books/non-existent-slug');
      expect(response.status).toBe(404);
    });
  });

  describe('Reading Progress Endpoints', () => {
    it('POST /books/:slug/progress - should save reading progress', async () => {
      const response = await client.post(
        `/books/${bookSlug}/progress`,
        { chapterIndex: 0, scrollPosition: 0.25 },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );

      expect(response.status).toBe(200);
    });

    it('GET /books/:slug/progress - should retrieve reading progress', async () => {
      await client.post(
        `/books/${bookSlug}/progress`,
        { chapterIndex: 1, scrollPosition: 0.5 },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );

      const response = await client.get(`/books/${bookSlug}/progress`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data.data.chapterIndex).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await client.post(`/books/${bookSlug}/progress`, {
        chapterIndex: 0,
        scrollPosition: 0.1,
      });
      expect(response.status).toBe(401);
    });
  });

  describe('Comments Endpoints', () => {
    it('POST /books/:slug/comments - should create comment', async () => {
      const response = await client.post(
        `/books/${bookSlug}/comments`,
        { body: 'Great book!' },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );

      expect(response.status).toBe(201);
      expect(response.data.data.body).toBe('Great book!');
    });

    it('GET /books/:slug/comments - should list comments (public)', async () => {
      await client.post(
        `/books/${bookSlug}/comments`,
        { body: 'Comment 1' },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );

      const response = await client.get(`/books/${bookSlug}/comments`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('POST /comments/:id/like - should like comment', async () => {
      const comment = await client.post(
        `/books/${bookSlug}/comments`,
        { body: 'Likeable' },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );

      const response = await client.post(
        `/comments/${comment.data.data.id}/like`,
        {},
        { headers: { Authorization: `Bearer ${user2Token}` } }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Subscription Endpoints', () => {
    it('GET /subscriptions/plans - should list subscription plans (public)', async () => {
      const response = await client.get('/subscriptions/plans');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('GET /subscriptions/me - should get user subscription', async () => {
      const response = await client.get('/subscriptions/me', {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data.data).toBeNull();
    });

    it('should require authentication for /subscriptions/me', async () => {
      const response = await client.get('/subscriptions/me');
      expect(response.status).toBe(401);
    });
  });

  describe('Health Check', () => {
    it('GET /health - should return server status', async () => {
      const response = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent resources', async () => {
      const response = await client.get('/books/non-existent-slug');
      expect(response.status).toBe(404);
      expect(response.data.error).toBeDefined();
    });
  });
});
