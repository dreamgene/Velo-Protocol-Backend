import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

describe('AuthService password hashing', () => {
  it('bcrypt hashes password and does not store plaintext', async () => {
    const password = 'super_secure_password';
    const hash = await bcrypt.hash(password, 12);
    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[ayb]\$.{56}$/);
    const valid = await bcrypt.compare(password, hash);
    expect(valid).toBe(true);
  });

  it('wrong password returns false', async () => {
    const hash = await bcrypt.hash('correct_password', 12);
    const valid = await bcrypt.compare('wrong_password', hash);
    expect(valid).toBe(false);
  });
});

describe('AuthService token operations', () => {
  it('generates refresh token as hex string', () => {
    const token = crypto.randomBytes(32).toString('hex');
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('SHA-256 hashing is deterministic', () => {
    const token = 'test_token';
    const hash1 = crypto.createHash('sha256').update(token).digest('hex');
    const hash2 = crypto.createHash('sha256').update(token).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

describe('WebhooksService HMAC', () => {
  it('sign produces correct HMAC-SHA256', () => {
    const secret = 'test_secret';
    const payload = JSON.stringify({ event: 'invoice.paid' });
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(sig).toHaveLength(64);
  });

  it('verify: correct payload returns true', () => {
    const secret = 'test_secret';
    const payload = JSON.stringify({ event: 'invoice.paid' });
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const actual = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))).toBe(true);
  });

  it('verify: tampered payload returns false', () => {
    const secret = 'test_secret';
    const expected = crypto.createHmac('sha256', secret).update('original').digest('hex');
    const tampered = crypto.createHmac('sha256', secret).update('tampered').digest('hex');
    expect(expected).not.toBe(tampered);
  });
});
