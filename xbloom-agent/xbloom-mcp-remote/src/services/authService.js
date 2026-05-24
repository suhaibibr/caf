import { BadRequestError, UnauthorizedError } from "../errors.js";

export class AuthService {
  constructor({ xbloomClient, sessionStore, sessionTtlSeconds, logger }) {
    this.xbloomClient = xbloomClient;
    this.sessionStore = sessionStore;
    this.sessionTtlSeconds = sessionTtlSeconds;
    this.logger = logger;
  }

  async login(email, password) {
    if (!email || !password) {
      throw new BadRequestError("Both email and password are required.");
    }

    this.logger.info("login_attempt", { email });

    const response = await this.xbloomClient.postPlain("tMemberLogin.thtml", {
      interfaceVersion: 20240918,
      skey: "testskey",
      clientType: 2,
      phoneType: "Android",
      languageType: 1,
      email,
      password
    });

    if (response.result !== "success" || !response.token || !response.member?.tableId) {
      this.logger.warn("login_failed", { email, result: response.result || "unknown" });
      throw new UnauthorizedError("xBloom login failed. Check email/password.");
    }

    const credentials = {
      memberId: Number(response.member.tableId),
      token: String(response.token),
      email
    };

    const session = await this.sessionStore.createSession(credentials, this.sessionTtlSeconds);
    this.logger.info("login_success", { email, memberId: credentials.memberId });

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      memberId: credentials.memberId,
      email: credentials.email
    };
  }

  async requireCredentials(sessionToken) {
    return this.sessionStore.requireCredentials(sessionToken);
  }
}
