/**
 * Auth Service
 * Login only. Multi-user auth and roles are out of scope per the cahier des
 * charges, so this stays as small as it can be while still gating the app.
 */
import { appError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signSessionToken } from '../lib/session.js';
import UserRepository from '../repositories/user.repository.js';

export default class AuthService {
  /** @param {UserRepository} [userRepository] injectable for tests */
  constructor(userRepository = new UserRepository()) {
    this.users = userRepository;
  }

  /**
   * Creates an account and its first session.
   * @param {{ email: string, name: string, password: string }} input already validated
   * @returns {Promise<{ user: object, token: string }>}
   */
  async signup({ email, name, password }) {
    const user = await this.users.insert({
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
   * @returns {Promise<{ user: object, token: string }>}
   */
  async login({ email, password }) {
    const row = await this.users.findByEmailWithHash(email.toLowerCase());
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
   * @returns {Promise<object>}
   */
  async getCurrentUser(id) {
    const user = await this.users.findById(id);
    if (!user) throw appError('Session expirée.', 'UNAUTHORIZED', 401);
    return user;
  }
}
