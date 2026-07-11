const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const { connectDB, disconnectDB } = require('../src/db');
const User = require('../src/models/user');
const Breed = require('../src/models/breed');
const RefreshToken = require('../src/models/refreshToken');

let mongod;
let app;

// Register a fresh user and return helpers that attach the Authorization header.
async function newUser(username = `u${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`) {
  const res = await request(app).post('/api/auth/register').send({ username, password: 'secret123' });
  const token = res.body.accessToken;
  return {
    token,
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    del: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
  app = createApp();
});

afterAll(async () => {
  await disconnectDB();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Breed.deleteMany({});
  await RefreshToken.deleteMany({});
});

describe('auth', () => {
  it('registers a user, returns tokens, and seeds their breeds', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'alice', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.username).toBe('alice');

    const user = await User.findOne({ username: 'alice' });
    const count = await Breed.countDocuments({ userId: user._id });
    expect(count).toBeGreaterThan(50);
  });

  it('rejects duplicate username (409), invalid username (400) and weak password (400)', async () => {
    await request(app).post('/api/auth/register').send({ username: 'dupuser', password: 'secret123' });
    const dup = await request(app).post('/api/auth/register').send({ username: 'dupuser', password: 'secret123' });
    expect(dup.status).toBe(409);

    const badName = await request(app).post('/api/auth/register').send({ username: 'a b@', password: 'secret123' });
    expect(badName.status).toBe(400);

    const weak = await request(app).post('/api/auth/register').send({ username: 'weakpw', password: '123' });
    expect(weak.status).toBe(400);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await request(app).post('/api/auth/register').send({ username: 'loginuser', password: 'secret123' });

    const ok = await request(app).post('/api/auth/login').send({ username: 'loginuser', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    expect(ok.body.refreshToken).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ username: 'loginuser', password: 'wrong' });
    expect(bad.status).toBe(401);
  });
});

describe('refresh-token rotation', () => {
  it('rotates: exchanges a refresh token for a new pair and invalidates the old one', async () => {
    const reg = await request(app).post('/api/auth/register').send({ username: 'rotator', password: 'secret123' });
    const first = reg.body.refreshToken;

    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTruthy();
    expect(r1.body.refreshToken).toBeTruthy();
    expect(r1.body.refreshToken).not.toBe(first);

    // The original (now rotated) token can no longer be used.
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);

    // The new one works.
    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(r2.status).toBe(200);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const reg = await request(app).post('/api/auth/register').send({ username: 'byeuser', password: 'secret123' });
    const rt = reg.body.refreshToken;

    expect((await request(app).post('/api/auth/logout').send({ refreshToken: rt })).status).toBe(204);
    // Once revoked it can't be refreshed.
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: rt })).status).toBe(401);
  });
});

describe('public reads vs protected writes', () => {
  it('serves the base breed list to anonymous visitors', async () => {
    const res = await request(app).get('/api/breeds');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(50);
    // The base list is a template, not tied to any user.
    expect((await request(app).get('/api/breeds/pug')).status).toBe(200);
  });

  it('401s on writes without a token', async () => {
    expect((await request(app).post('/api/breeds').send({ name: 'x' })).status).toBe(401);
    expect((await request(app).put('/api/breeds/pug').send({ name: 'y' })).status).toBe(401);
    expect((await request(app).delete('/api/breeds/pug')).status).toBe(401);
    expect((await request(app).post('/api/breeds/pug/sub-breeds').send({ subBreed: 's' })).status).toBe(401);
  });
});

describe('breed CRUD (scoped to the user)', () => {
  it('lists the seeded breeds sorted by name', async () => {
    const u = await newUser();
    const res = await u.get('/api/breeds');
    expect(res.status).toBe(200);
    const names = res.body.map((b) => b.name);
    expect(names.length).toBeGreaterThan(50);
    expect(names).toEqual([...names].sort());
  });

  it('creates, rejects duplicate (409) and invalid (400)', async () => {
    const u = await newUser();
    expect((await u.post('/api/breeds').send({ name: 'Testdog', subBreeds: ['Alpha'] })).status).toBe(201);
    expect((await u.post('/api/breeds').send({ name: 'pug' })).status).toBe(409);
    expect((await u.post('/api/breeds').send({ name: 'd0g!' })).status).toBe(400);
  });

  it('updates, deletes (stays gone), and handles sub-breeds', async () => {
    const u = await newUser();

    expect((await u.put('/api/breeds/pug').send({ name: 'pugly' })).status).toBe(200);
    expect((await u.get('/api/breeds/pug')).status).toBe(404);

    expect((await u.del('/api/breeds/boxer')).status).toBe(204);
    expect((await u.get('/api/breeds/boxer')).status).toBe(404);

    const add = await u.post('/api/breeds/bulldog/sub-breeds').send({ subBreed: 'mini' });
    expect(add.status).toBe(201);
    expect(add.body.subBreeds).toContain('mini');

    const del = await u.del('/api/breeds/bulldog/sub-breeds/boston');
    expect(del.status).toBe(200);
    expect(del.body.subBreeds).not.toContain('boston');
  });
});

describe('per-user isolation', () => {
  it("one user cannot see or affect another user's changes", async () => {
    const alice = await newUser('aliceiso');
    const bob = await newUser('bobiso');

    // Alice deletes pug and adds a custom breed.
    await alice.del('/api/breeds/pug');
    await alice.post('/api/breeds').send({ name: 'alicedog' });

    // Bob is unaffected: still has pug, does not have alicedog.
    expect((await bob.get('/api/breeds/pug')).status).toBe(200);
    expect((await bob.get('/api/breeds/alicedog')).status).toBe(404);

    // Alice sees her own changes.
    expect((await alice.get('/api/breeds/pug')).status).toBe(404);
    expect((await alice.get('/api/breeds/alicedog')).status).toBe(200);

    // The same breed name can be edited independently by each user.
    await alice.put('/api/breeds/boxer').send({ subBreeds: ['aliceonly'] });
    const bobBoxer = await bob.get('/api/breeds/boxer');
    expect(bobBoxer.body.subBreeds).not.toContain('aliceonly');
  });
});
