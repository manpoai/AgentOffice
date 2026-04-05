/**
 * Utility functions: ID generation, token hashing, password hashing
 */
import crypto from 'crypto';

export function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const result = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(result, 'hex'));
}
