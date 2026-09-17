import { appError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signSessionToken } from '../lib/session.js';
import { findByEmailWithHash, findById, insertUser } from '../db/userQueries.js';

/**
 * Creates an account and its first session.
 * @param {{ email: string, name: string, password: string }} input already validated
 * @returns {Promise<{ user: { id: string, email: string, name: string, createdAt: Date }, token: string }>}
 */
export async function signup({ email, name, password }) {
  const user = await insertUser({
    email: email.toLowerCase(),
    name,
    passwordHash: await hashPassword(password),
  });
  if (!user) throw appError('Un compte existe déjà avec cet e-mail.', 'EMAIL_TAKEN', 409);
  return { user, token: signSessionToken(user) };
}

/**
 * Verifies credentials and opens a session.
 * @param {{ email: string, password: string }} input already validated
 * @returns {Promise<{ user: { id: string, email: string, name: string, createdAt: Date }, token: string }>}
 */
export async function login({ email, password }) {
  const row = await findByEmailWithHash(email.toLowerCase());
  // Same message either way: never tell a caller which half was wrong.
  const invalid = appError('E-mail ou mot de passe incorrect.', 'INVALID_CREDENTIALS', 401);
  if (!row) throw invalid;
  if (!(await verifyPassword(password, row.passwordHash))) throw invalid;
  const { passwordHash, ...user } = row;
  return { user, token: signSessionToken(user) };
}

/**
 * The user behind a valid session, re-read from the DB (the token may outlive it).
 * @param {string} id
 * @returns {Promise<{ id: string, email: string, name: string, createdAt: Date }>}
 */
export async function getCurrentUser(id) {
  const user = await findById(id);
  if (!user) throw appError('Session expirée.', 'UNAUTHORIZED', 401);
  return user;
}
