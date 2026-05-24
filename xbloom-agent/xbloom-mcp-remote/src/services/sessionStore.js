import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { BadRequestError, UnauthorizedError } from "../errors.js";

const EMPTY_STORE = {
  version: 1,
  default_session_token: null,
  sessions: {}
};

export class SessionStore {
  constructor(filePath, encryptionService, logger) {
    this.filePath = filePath;
    this.encryptionService = encryptionService;
    this.logger = logger;
  }

  async ensureStoreFile() {
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await this.writeStore({ ...EMPTY_STORE });
    }
  }

  async createSession(credentials, ttlSeconds) {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new BadRequestError("Session TTL must be a positive number.");
    }

    await this.ensureStoreFile();
    const store = await this.readStore();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const sessionToken = randomBytes(32).toString("hex");
    const encryptedCredentials = this.encryptionService.encrypt(credentials);

    store.sessions[sessionToken] = {
      access_token: sessionToken,
      encrypted_credentials: encryptedCredentials,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    };
    store.default_session_token = sessionToken;

    await this.writeStore(store);

    return {
      sessionToken,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  async requireCredentials(sessionToken) {
    if (!sessionToken) throw new UnauthorizedError("Missing session token. Call /login first.");
    const credentials = await this.getCredentials(sessionToken);
    if (!credentials) throw new UnauthorizedError("Session not found or expired. Call /login again.");
    return credentials;
  }

  async getCredentials(sessionToken) {
    await this.ensureStoreFile();
    const store = await this.readStore();
    const record = store.sessions[sessionToken];
    if (!record) return null;

    const expiresAt = new Date(record.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      delete store.sessions[sessionToken];
      if (store.default_session_token === sessionToken) {
        store.default_session_token = null;
      }
      await this.writeStore(store);
      return null;
    }

    const decrypted = this.encryptionService.decrypt(record.encrypted_credentials);
    if (!decrypted) {
      delete store.sessions[sessionToken];
      if (store.default_session_token === sessionToken) {
        store.default_session_token = null;
      }
      await this.writeStore(store);
      return null;
    }

    return decrypted;
  }

  async getDefaultSessionToken() {
    await this.ensureStoreFile();
    const store = await this.readStore();
    return store.default_session_token || null;
  }

  async setDefaultSessionToken(sessionToken) {
    await this.ensureStoreFile();
    const store = await this.readStore();
    if (sessionToken && !store.sessions[sessionToken]) {
      throw new BadRequestError("Cannot set unknown session token as default.");
    }
    store.default_session_token = sessionToken || null;
    await this.writeStore(store);
  }

  async clearDefaultSession() {
    await this.setDefaultSessionToken(null);
  }

  async deleteSession(sessionToken) {
    await this.ensureStoreFile();
    const store = await this.readStore();
    delete store.sessions[sessionToken];
    if (store.default_session_token === sessionToken) {
      store.default_session_token = null;
    }
    await this.writeStore(store);
  }

  async readStore() {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        version: 1,
        default_session_token: parsed.default_session_token || null,
        sessions: parsed.sessions || {}
      };
    } catch {
      return { ...EMPTY_STORE };
    }
  }

  async writeStore(store) {
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(store, null, 2), "utf-8");
    await fs.rename(tempPath, this.filePath);
  }
}
