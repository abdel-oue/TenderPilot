/**
 * Auth Service
 * Login only. Multi-user auth and roles are out of scope per the cahier des
 * charges, so this stays as small as it can be while still gating the app.
 */
import { randomUUID } from 'node:crypto';
import { appError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { hashPassword, signSessionToken, verifyPassword } from '../lib/auth.js';
import DemoRepository, {
  DEMO_EMAIL_DOMAIN,
  DEMO_EMAIL_PREFIX,
} from '../repositories/demo.repository.js';
import UserRepository from '../repositories/user.repository.js';

// The account the seed fills. A demo visitor gets a COPY of it, never the thing
// itself: two people clicking "essayer" must not edit each other's dossiers.
const SEED_EMAIL = 'demo@tenderpilot.local';

export default class AuthService {
  /**
   * @param {UserRepository} [userRepository] injectable for tests
   * @param {DemoRepository} [demoRepository]
   */
  constructor(userRepository = new UserRepository(), demoRepository = new DemoRepository()) {
    this.users = userRepository;
    this.demo = demoRepository;
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
   * Opens a throwaway workspace pre-filled with the sample dataset.
   *
   * A temporary user rather than a shared login: the whole app is owner-scoped,
   * so a copy is both isolated and cheap - and a visitor who deletes a dossier
   * deletes their own, not the demo everyone else is about to see.
   *
   * The clone carries the chunks and their embeddings across, so it costs no
   * OCR and no embedding quota. What it cannot invent is indexing the seed
   * account never had: run `npm run db:seed && npm run db:index` and every demo
   * after it inherits a searchable corpus.
   *
   * @returns {Promise<{ user: object, token: string }>}
   */
  async startDemo() {
    // No cron: the next visitor reaps the expired ones. Filtered on the minted
    // email shape AND on age, so it cannot reach a real account.
    const reaped = await this.demo.deleteExpiredDemoUsers();

    const source = await this.users.findByEmailWithHash(SEED_EMAIL);
    if (!source) {
      throw appError(
        'Espace de démonstration indisponible : le jeu de données n a pas été chargé.',
        'DEMO_UNAVAILABLE',
        503,
      );
    }

    const user = await this.users.insert({
      email: DEMO_EMAIL_PREFIX + randomUUID().slice(0, 8) + DEMO_EMAIL_DOMAIN,
      name: 'Visiteur démo',
      // Nobody ever signs back in with it: the session cookie is the only way in.
      passwordHash: await hashPassword(randomUUID()),
    });
    if (!user) throw appError('Espace de démonstration indisponible.', 'DEMO_UNAVAILABLE', 503);

    const tally = await this.demo.cloneWorkspace(source.id, user.id);
    logger.info({ demoUserId: user.id, reaped, ...tally }, 'auth: demo workspace created');

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
