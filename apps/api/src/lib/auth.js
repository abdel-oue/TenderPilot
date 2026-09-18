/**
 * Auth primitives: password hashing, and the session token + cookie + guard.
 *
 * Both halves are node:crypto and nothing else — no bcrypt, no jsonwebtoken.
 */
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { env } from './env.js';
import { appError } from './errors.js';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password with scrypt (Node built-in — no bcrypt dependency).
 * @param {string} password
 * @returns {Promise<string>} `scrypt$<saltHex>$<hashHex>`
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Constant-time check of a password against a stored hash.
 * @param {string} password
 * @param {string} stored value produced by hashPassword
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

// HS256 JWT in an httpOnly cookie. Hand-rolled because it is ~30 lines of
// node:crypto and the alternative is another dependency.
// ponytail: stateless tokens cannot be revoked before expiry — add a sessions
// table if "log out everywhere" is ever a requirement.
export const SESSION_COOKIE = 'tp_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

/** @param {string|Buffer} value @returns {string} */
function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

/** @param {string} signingInput @returns {Buffer} */
function sign(signingInput) {
  return createHmac('sha256', env.JWT_SECRET).update(signingInput).digest();
}

/**
 * Issues a session token for a user.
 * @param {{ id: string, email: string }} user
 * @returns {string} JWT
 */
export function signSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub: user.id, email: user.email, iat: now, exp: now + MAX_AGE_SECONDS }));
  const signingInput = `${HEADER}.${payload}`;
  return `${signingInput}.${sign(signingInput).toString('base64url')}`;
}

/**
 * Verifies signature and expiry.
 * @param {string} token
 * @returns {{ sub: string, email: string, iat: number, exp: number } | null} null when invalid or expired
 */
export function verifySessionToken(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (header !== HEADER) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Sets the session cookie on a reply.
 * @param {import('fastify').FastifyReply} reply
 * @param {string} token
 * @returns {void}
 */
export function setSessionCookie(reply, token) {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header('set-cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}${secure}`);
}

/**
 * Clears the session cookie.
 * @param {import('fastify').FastifyReply} reply
 * @returns {void}
 */
export function clearSessionCookie(reply) {
  reply.header('set-cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

/**
 * Reads the session cookie off a request.
 * @param {import('fastify').FastifyRequest} request
 * @returns {string | null}
 */
export function readSessionCookie(request) {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

/**
 * Fastify preHandler: rejects unauthenticated requests, sets `request.user`.
 * @param {import('fastify').FastifyRequest} request
 * @returns {Promise<void>}
 */
export async function requireAuth(request) {
  const claims = verifySessionToken(readSessionCookie(request) ?? '');
  if (!claims) throw appError('Vous devez être connecté.', 'UNAUTHORIZED', 401);
  request.user = { id: claims.sub, email: claims.email };
}
