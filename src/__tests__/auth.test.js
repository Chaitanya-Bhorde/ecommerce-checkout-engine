const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { startDb, stopDb, clearDb, request } = require('./helpers');

jest.setTimeout(60000);

beforeAll(async () => {
  await startDb();
});
beforeEach(async () => {
  await clearDb();
});
afterAll(async () => {
  await stopDb();
});

const newToken = () => crypto.randomBytes(24).toString('hex');
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Tests always clear the DB between cases, so a fixed default email is safe
// and keeps the requests below (which hardcode this address) consistent.
const seedUser = (email = 'reset@example.com') =>
  User.create({
    name: 'Reset User',
    email,
    password: 'password1',
  });

const seedToken = async (user, expires = new Date(Date.now() + 15 * 60 * 1000)) => {
  const token = newToken();
  user.resetPasswordToken = sha256(token);
  user.resetPasswordExpiry = expires;
  await user.save();
  return token;
};

describe('Auth API', () => {
  it('registers, logs in, authenticates and logs out', async () => {
    const agent = request.agent(app);
    const reg = await agent
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'password1' });
    expect(reg.status).toBe(201);

    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password1' });
    expect(login.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('alice@example.com');

    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
  });

  it('rejects duplicate email, weak password and missing fields', async () => {
    const mk = (email, password) =>
      request(app).post('/api/auth/register').send({ name: 'Bob', email, password });
    await mk('bob@example.com', 'password1');
    expect((await mk('bob@example.com', 'password1')).status).toBe(400);
    expect((await mk('bob2@example.com', 'weak')).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ name: 'X' })).status).toBe(400);
  });

  it('login rejects wrong password and unknown user', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Carol', email: 'carol@example.com', password: 'password1' });
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'carol@example.com', password: 'password9' })).status
    ).toBe(401);
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password1' })).status
    ).toBe(401);
  });
});

describe('Password reset (secure token flow)', () => {
  it('unauthenticated direct reset endpoint no longer exists', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password-direct')
      .send({ email: 'reset@example.com', password: 'password2' });
    expect([404, 405]).toContain(res.status);
  });

  it('forgot-password responds generically and never stores tokens in notifications', async () => {
    const user = await seedUser();
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' });
    expect(known.status).toBe(200);
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);

    const notif = await Notification.findOne({ userId: user._id });
    expect(notif).toBeTruthy();
    expect(JSON.stringify(notif.toObject())).not.toMatch(/token/i);

    const updated = await User.findById(user._id).select('+resetPasswordToken');
    expect(updated.resetPasswordToken).toBeTruthy();
  });

  it('rejects invalid, expired and reused tokens; valid token changes the password', async () => {
    await seedUser('invalid@example.com');
    const bad = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: newToken(), password: 'password2' });
    expect(bad.status).toBe(400);

    const u2 = await seedUser('expired@example.com');
    const t2 = await seedToken(u2, new Date(Date.now() - 1000));
    const exp = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: t2, password: 'password2' });
    expect(exp.status).toBe(400);

    const u3 = await seedUser('reset@example.com');
    const t3 = await seedToken(u3);
    const ok = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: t3, password: 'password2' });
    expect(ok.status).toBe(200);

    const fresh = await User.findById(u3._id).select('+password +resetPasswordToken');
    expect(await fresh.comparePassword('password2')).toBe(true);
    expect(await fresh.comparePassword('password1')).toBe(false);
    expect(fresh.resetPasswordToken).toBeFalsy();

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: t3, password: 'password3' });
    expect(reuse.status).toBe(400);

    expect(
      (await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'password2' })).status
    ).toBe(200);
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'password1' })).status
    ).toBe(401);
  });

  it('stores reset tokens as hashes, never as plaintext', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const u = await seedUser();
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' });
      expect(res.status).toBe(200);
      expect(typeof res.body.resetToken).toBe('string');

      const doc = await User.findById(u._id).select('+resetPasswordToken');
      expect(doc.resetPasswordToken).toBe(sha256(res.body.resetToken));
      expect(doc.resetPasswordToken).not.toBe(res.body.resetToken);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
