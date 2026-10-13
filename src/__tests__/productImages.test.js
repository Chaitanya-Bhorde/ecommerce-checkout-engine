const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');
const { startDb, stopDb, clearDb, createProduct } = require('./helpers');

jest.setTimeout(90000);

beforeAll(async () => { await startDb(); });
beforeEach(async () => { await clearDb(); });
afterAll(async () => { await stopDb(); });

const DEAD_URL_MARKERS = [
  'photo-1558618666-fcd25c85f82e',
  'photo-1611186871348-b1c6962cf3b4',
  'photo-1562183241-b936e665817b',
  'photo-1546868871-af0de0ae72be',
  'photo-1544923246-77307dd270cb',
  'photo-1586401100295-7aaf54e1a5f6',
  'photo-1599058917212-d7900895e4c8',
  'photo-1544383835-bda2bc80a67d',
  'photo-1526379095098-d400fd6cda6b',
  'photo-1507473885765-e6ed057ab6fe',
  'photo-1507473885765-e6ed057ab6fb',
  'photo-1570194065650-d99fb4b38b17',
  'photo-1608248597279-f99d160bfbc8',
  'photo-1434389677669-e08b4cda3a38',
  'photo-1620799140408-ed5341c243ca',
  'photo-1522335789203-aabd20f1a6f3',
];

const seedSrc = fs.readFileSync(path.join(__dirname, '..', 'utils', 'seedDemo.js'), 'utf8');

describe('Product image integrity — seed data', () => {
  it('seeds every product with at least one absolute https image URL on a known CDN host', () => {
    const blocks = [...seedSrc.matchAll(/images:\s*\[([^\]]*)\]/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(50);
    for (const block of blocks) {
      const urls = (block[1].match(/'([^']*)'/g) || []).map((s) => s.slice(1, -1));
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[^ ]+$/);
      }
    }
  });

  it('does not contain image URLs that were verified dead (HTTP 404) in the live catalog', () => {
    for (const marker of DEAD_URL_MARKERS) {
      expect(seedSrc).not.toContain(marker);
    }
  });
});

describe('Product image integrity — API contract for UI fallbacks', () => {
  it('preserves each product images array (including empty arrays) in the public catalog response', async () => {
    const imageUrl = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
    const withImages = await createProduct({ name: 'Img Product', images: [imageUrl] });
    const withoutImages = await createProduct({ name: 'No Image Product', images: [] });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);

    const list = res.body.products;
    expect(Array.isArray(list)).toBe(true);
    const gotWith = list.find((p) => String(p._id) === String(withImages._id));
    const gotWithout = list.find((p) => String(p._id) === String(withoutImages._id));
    expect(gotWith.images).toEqual([imageUrl]);
    expect(Array.isArray(gotWithout.images)).toBe(true);
    expect(gotWithout.images).toEqual([]);
  });
});
