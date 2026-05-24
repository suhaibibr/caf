import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export class EncryptionService {
  constructor(secret, salt) {
    this.key = createHmac("sha256", secret).update(salt).digest();
  }

  encrypt(value) {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", this.key, iv);
    const input = Buffer.from(JSON.stringify(value), "utf-8");
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    return Buffer.concat([iv, encrypted]).toString("base64url");
  }

  decrypt(blob) {
    try {
      const combined = Buffer.from(blob, "base64url");
      if (combined.length < 17) return null;
      const iv = combined.subarray(0, 16);
      const encrypted = combined.subarray(16);
      const decipher = createDecipheriv("aes-256-cbc", this.key, iv);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(decrypted.toString("utf-8"));
    } catch {
      return null;
    }
  }
}
