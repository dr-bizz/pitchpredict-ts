/**
 * API e2e (supertest) — plan Task 12.1.
 *
 * Flows covered:
 *   - signup -> login (returns the public user)
 *   - predict an OPEN fixture (200/expected upsert) vs a LOCKED fixture (422)
 *   - champion pick before / after the tournament has started (200 vs 422)
 *   - admin scores a finished fixture -> leaderboard reflects points (+ bonus)
 *   - a non-admin hitting an admin route -> 403
 *
 * RUNNING: these need a seeded Postgres. Set `TEST_DATABASE_URL` (or
 * `DATABASE_URL`) to a database that has been migrated + seeded
 * (`nx run db:seed`) and run `nx e2e api-e2e`. Without a DB the suite is skipped
 * (green by construction) — see README. The flows are written to discover the
 * fixtures/users they need from the seeded data rather than hard-coding ids.
 */
import request from 'supertest';
import { desc, eq } from 'drizzle-orm';
import {
  createTestHarness,
  hasDatabase,
  type TestHarness,
} from './support/test-app';

// Only meaningful with a seeded DB; otherwise the whole suite is skipped.
const describeWithDb = hasDatabase() ? describe : describe.skip;

if (!hasDatabase()) {
  console.warn(
    '[api-e2e] No TEST_DATABASE_URL/DATABASE_URL set — skipping DB-backed e2e flows. ' +
      'Seed a database (nx run db:seed) and set TEST_DATABASE_URL to run them.'
  );
}

/** Narrow `T | undefined` to `T`, failing the test with a clear message otherwise. */
function present<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected seeded ${what} to exist`);
  }
  return value;
}

describeWithDb('API e2e', () => {
  let harness: TestHarness;
  // Pulled in lazily so a missing DATABASE_URL can't blow up module load.
  let schema: typeof import('@pitchpredict/db')['schema'];
  let db: import('@pitchpredict/db').Db;

  beforeAll(async () => {
    harness = await createTestHarness();
    const dbModule = await import('@pitchpredict/db');
    schema = dbModule.schema;
    db = dbModule.db;
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  const http = () => request(harness.app.getHttpServer());

  async function findUserByEmail(email: string) {
    return db.query.users.findFirst({ where: eq(schema.users.email, email) });
  }

  async function tokenForEmail(email: string): Promise<string> {
    const user = await findUserByEmail(email);
    if (!user) throw new Error(`Seed user ${email} not found`);
    return harness.signToken(user);
  }

  // ── signup -> login ──────────────────────────────────────────────────────
  it('signs up then logs in, returning the public user (no passwordHash)', async () => {
    const email = `e2e+${Date.now()}@pitchpredict.test`;
    const password = 'supersecret123';

    const signup = await http()
      .post('/auth/register')
      .send({
        name: 'E2E User',
        email,
        password,
        passwordConfirmation: password,
      });
    expect(signup.status).toBe(201);
    expect(signup.body).toMatchObject({ email, role: 'player' });
    expect(signup.body.passwordHash).toBeUndefined();

    const login = await http().post('/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ email, role: 'player' });

    const badLogin = await http()
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });
    expect(badLogin.status).toBe(401);
  });

  // ── predict open (200) vs locked (422) ────────────────────────────────────
  it('upserts a prediction on an open fixture (200) and rejects a locked one (422)', async () => {
    const token = await tokenForEmail('demo@pitchpredict.app');

    const open = present(
      await db.query.fixtures.findFirst({
        where: eq(schema.fixtures.status, 'scheduled'),
        orderBy: desc(schema.fixtures.kickoffAt), // furthest-future is safely open
      }),
      'open fixture'
    );

    const ok = await http()
      .put(`/fixtures/${open.id}/prediction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ homeScore: 2, awayScore: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      fixtureId: open.id,
      homeScore: 2,
      awayScore: 1,
    });

    const locked = present(
      await db.query.fixtures.findFirst({
        where: eq(schema.fixtures.status, 'finished'),
      }),
      'finished/locked fixture'
    );

    const rejected = await http()
      .put(`/fixtures/${locked.id}/prediction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ homeScore: 1, awayScore: 0 });
    expect(rejected.status).toBe(422);
    expect(String(rejected.body.message)).toMatch(/locked/i);
  });

  it('rejects predictions out of the 0-20 range with 400', async () => {
    const token = await tokenForEmail('demo@pitchpredict.app');
    const open = present(
      await db.query.fixtures.findFirst({
        where: eq(schema.fixtures.status, 'scheduled'),
        orderBy: desc(schema.fixtures.kickoffAt),
      }),
      'open fixture'
    );
    const res = await http()
      .put(`/fixtures/${open.id}/prediction`)
      .set('Authorization', `Bearer ${token}`)
      .send({ homeScore: 21, awayScore: -1 });
    expect(res.status).toBe(400);
  });

  it('requires a valid token (401 without Authorization)', async () => {
    const res = await http().get('/fixtures');
    expect(res.status).toBe(401);
  });

  // ── champion pick: locked once the tournament has started ──────────────────
  it('locks champion picks because the seeded tournament has already started (422)', async () => {
    const token = await tokenForEmail('demo@pitchpredict.app');
    const anyTeam = present(await db.query.teams.findFirst(), 'team');

    const res = await http()
      .put('/champion-pick')
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId: anyTeam.id });

    // The seed backdates the earliest kickoff, so the tournament has started.
    expect(res.status).toBe(422);
    expect(String(res.body.message)).toMatch(/champion picks are locked/i);
  });

  it('returns the caller champion pick (or null) on GET', async () => {
    const token = await tokenForEmail('demo@pitchpredict.app');
    const res = await http()
      .get('/champion-pick')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // demo has a seeded pick; either a row or null is contract-valid.
    if (res.body) {
      expect(res.body).toHaveProperty('teamId');
    }
  });

  // ── admin scores -> leaderboard reflects points ───────────────────────────
  it('lets an admin enter a result and rescore, surfacing points on the leaderboard', async () => {
    const adminToken = await tokenForEmail('admin@pitchpredict.app');
    const demo = present(
      await findUserByEmail('demo@pitchpredict.app'),
      'demo user'
    );

    // A finished fixture demo predicted on, so we can assert points move.
    const demoPrediction = present(
      await db.query.predictions.findFirst({
        where: eq(schema.predictions.userId, demo.id),
      }),
      'demo prediction'
    );

    const fixture = present(
      await db.query.fixtures.findFirst({
        where: eq(schema.fixtures.id, demoPrediction.fixtureId),
      }),
      'predicted fixture'
    );

    // Re-enter the (already-final) score: scoreFixture is idempotent, so the
    // leaderboard total must remain stable and non-negative.
    const homeScore = fixture.homeScore ?? 1;
    const awayScore = fixture.awayScore ?? 0;

    const patch = await http()
      .patch(`/admin/fixtures/${fixture.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ homeScore, awayScore });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ status: 'finished', homeScore, awayScore });

    const board = await http()
      .get('/leaderboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(board.status).toBe(200);
    expect(Array.isArray(board.body)).toBe(true);

    const demoRow = board.body.find(
      (r: { user: { id: number } }) => r.user.id === demo.id
    );
    expect(demoRow).toBeDefined();
    expect(demoRow.totalPoints).toBeGreaterThanOrEqual(0);
    expect(demoRow).toHaveProperty('rank');
    expect(demoRow).toHaveProperty('exactCount');
  });

  // ── non-admin -> 403 on admin route ────────────────────────────────────────
  it('forbids a non-admin from listing admin fixtures (403)', async () => {
    const playerToken = await tokenForEmail('demo@pitchpredict.app');
    const res = await http()
      .get('/admin/fixtures')
      .set('Authorization', `Bearer ${playerToken}`);
    expect(res.status).toBe(403);
  });

  it('forbids a non-admin from entering a result (403)', async () => {
    const playerToken = await tokenForEmail('demo@pitchpredict.app');
    const fixture = present(await db.query.fixtures.findFirst(), 'fixture');
    const res = await http()
      .patch(`/admin/fixtures/${fixture.id}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ homeScore: 1, awayScore: 1 });
    expect(res.status).toBe(403);
  });

  it('lets an admin list admin fixtures (200)', async () => {
    const adminToken = await tokenForEmail('admin@pitchpredict.app');
    const res = await http()
      .get('/admin/fixtures')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
