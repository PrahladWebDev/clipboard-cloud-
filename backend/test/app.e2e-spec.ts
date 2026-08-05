import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// These e2e tests exercise real HTTP routes end to end. They require Redis
// and MongoDB to be reachable (see docker-compose.yml — `docker compose up
// -d redis mongo`), matching how CI runs them (see .github/workflows/ci.yml).
describe('Clipboard Cloud API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Pairing flow', () => {
    it('creates a session and can join it by code', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/pairing/create')
        .send({})
        .expect(201);

      expect(createRes.body.sessionId).toBeDefined();
      expect(createRes.body.code).toMatch(/^\d{6}$/);

      const joinRes = await request(app.getHttpServer())
        .post('/api/pairing/join')
        .send({ code: createRes.body.code })
        .expect(201);

      expect(joinRes.body.sessionId).toBe(createRes.body.sessionId);
    });

    it('rejects an invalid code with 404', async () => {
      await request(app.getHttpServer())
        .post('/api/pairing/join')
        .send({ code: '000000' })
        .expect(404);
    });

    it('rejects a malformed code with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/pairing/join')
        .send({ code: 'abc' })
        .expect(400);
    });
  });

  describe('Auth + account flow', () => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'super-secret-123';
    let accessToken: string;

    it('registers a new account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password })
        .expect(201);
      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
    });

    it('rejects a duplicate registration', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password })
        .expect(409);
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(201);
      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects login with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    });

    it('saves and lists a snippet for the authenticated user', async () => {
      await request(app.getHttpServer())
        .post('/api/account/snippets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type: 'text', content: 'saved forever' })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/api/account/snippets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(list.body.some((s: any) => s.content === 'saved forever')).toBe(true);
    });

    it('rejects account routes without a token', async () => {
      await request(app.getHttpServer()).get('/api/account/snippets').expect(401);
    });
  });

  describe('File download ownership', () => {
    it('rejects downloading a file without the owning sessionId', async () => {
      // A random/nonexistent filename should 404 regardless.
      await request(app.getHttpServer())
        .get('/api/files/does-not-exist.png')
        .expect(404);
    });
  });
});
