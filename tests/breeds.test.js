const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const { connectDB, disconnectDB } = require('../src/db');
const { seedIfEmpty } = require('../src/seed');
const Breed = require('../src/models/breed');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDB(mongod.getUri());
  app = createApp();
});

afterAll(async () => {
  await disconnectDB();
  if (mongod) await mongod.stop();
});

// Fresh, seeded database before each test for isolation.
beforeEach(async () => {
  await Breed.deleteMany({});
  await seedIfEmpty();
});

describe('seeding', () => {
  it('loads breeds from dogs.json when empty', async () => {
    const count = await Breed.estimatedDocumentCount();
    expect(count).toBeGreaterThan(50);
    const bulldog = await Breed.findOne({ name: 'bulldog' });
    expect(bulldog.subBreeds).toEqual(expect.arrayContaining(['boston', 'french']));
  });
});

describe('GET /api/breeds', () => {
  it('returns all breeds sorted by name', async () => {
    const res = await request(app).get('/api/breeds');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const names = res.body.map((b) => b.name);
    expect(names).toEqual([...names].sort());
  });

  it('filters by search term (breed or sub-breed)', async () => {
    const res = await request(app).get('/api/breeds?search=boston');
    expect(res.status).toBe(200);
    expect(res.body.some((b) => b.name === 'bulldog')).toBe(true);
  });
});

describe('GET /api/breeds/:name', () => {
  it('returns a single breed', async () => {
    const res = await request(app).get('/api/breeds/pug');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('pug');
  });

  it('404s for a missing breed', async () => {
    const res = await request(app).get('/api/breeds/notabreed');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/not found/i);
  });
});

describe('POST /api/breeds', () => {
  it('creates a breed', async () => {
    const res = await request(app).post('/api/breeds').send({ name: 'Testdog', subBreeds: ['Alpha'] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('testdog');
    expect(res.body.subBreeds).toEqual(['alpha']);
  });

  it('409s on duplicate breed', async () => {
    const res = await request(app).post('/api/breeds').send({ name: 'pug' });
    expect(res.status).toBe(409);
  });

  it('400s on empty name', async () => {
    const res = await request(app).post('/api/breeds').send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('400s on name with invalid characters', async () => {
    const res = await request(app).post('/api/breeds').send({ name: 'dog123!' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/breeds/:name', () => {
  it('renames a breed', async () => {
    const res = await request(app).put('/api/breeds/pug').send({ name: 'pugly' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('pugly');
    expect(await Breed.findOne({ name: 'pug' })).toBeNull();
  });

  it('replaces the sub-breed list', async () => {
    const res = await request(app).put('/api/breeds/bulldog').send({ subBreeds: ['english'] });
    expect(res.status).toBe(200);
    expect(res.body.subBreeds).toEqual(['english']);
  });

  it('409s when renaming onto an existing breed', async () => {
    const res = await request(app).put('/api/breeds/pug').send({ name: 'boxer' });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/breeds/:name', () => {
  it('deletes a breed and it stays gone', async () => {
    const del = await request(app).delete('/api/breeds/pug');
    expect(del.status).toBe(204);
    const res = await request(app).get('/api/breeds/pug');
    expect(res.status).toBe(404);
  });

  it('404s deleting a missing breed', async () => {
    const res = await request(app).delete('/api/breeds/notabreed');
    expect(res.status).toBe(404);
  });
});

describe('sub-breed endpoints', () => {
  it('adds a sub-breed', async () => {
    const res = await request(app).post('/api/breeds/pug/sub-breeds').send({ subBreed: 'mini' });
    expect(res.status).toBe(201);
    expect(res.body.subBreeds).toContain('mini');
  });

  it('409s adding a duplicate sub-breed', async () => {
    const res = await request(app).post('/api/breeds/bulldog/sub-breeds').send({ subBreed: 'boston' });
    expect(res.status).toBe(409);
  });

  it('renames a sub-breed', async () => {
    const res = await request(app).put('/api/breeds/bulldog/sub-breeds/boston').send({ subBreed: 'bostonian' });
    expect(res.status).toBe(200);
    expect(res.body.subBreeds).toContain('bostonian');
    expect(res.body.subBreeds).not.toContain('boston');
  });

  it('deletes a sub-breed', async () => {
    const res = await request(app).delete('/api/breeds/bulldog/sub-breeds/boston');
    expect(res.status).toBe(200);
    expect(res.body.subBreeds).not.toContain('boston');
  });

  it('404s for a missing sub-breed', async () => {
    const res = await request(app).delete('/api/breeds/bulldog/sub-breeds/nope');
    expect(res.status).toBe(404);
  });
});
