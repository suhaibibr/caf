import { constants, publicEncrypt } from "node:crypto";
import { UpstreamError } from "../errors.js";

const RSA_PUBLIC_KEY_B64 =
  "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC4LF40GZ72SdhMyl765K/i4nY5" +
  "CPcHz2Q1IKWKZ9S79xmK7G8pUhbVf4EZLvnNF1+9IvOFQUKV5Z7ZNNviqSpnql9" +
  "tAT+8+J/He0R7pcirvVSxgdr2i9V/C/gmqAEZ5qVTzRnd3uWdFoKzPdEBxP0Ipor" +
  "J1VBbCv90yBSOhVxO+QIDAQAB";

const pemBody = RSA_PUBLIC_KEY_B64.match(/.{1,64}/g)?.join("\n");
if (!pemBody) {
  throw new Error("Failed to initialize xBloom RSA public key.");
}

const RSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`;

export class XBloomClient {
  constructor({ apiBase, shareBase }) {
    this.apiBase = apiBase;
    this.shareBase = shareBase;
  }

  authBase(credentials) {
    return {
      interfaceVersion: 20240918,
      skey: "testskey",
      phoneType: "Android",
      memberId: credentials.memberId,
      clientType: 2,
      languageType: 1,
      token: credentials.token
    };
  }

  async postPlain(endpoint, payload) {
    return this.postJson(endpoint, payload);
  }

  async postEncrypted(endpoint, payload) {
    const encrypted = this.rsaEncrypt(payload);
    return this.postJson(endpoint, encrypted);
  }

  async postJson(endpoint, body) {
    const url = `${this.apiBase}/${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      Referer: `${this.shareBase}/`,
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
    };

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new UpstreamError("Failed to connect to xBloom API.", { cause: String(error) });
    }

    const text = await response.text();
    if (!response.ok) {
      throw new UpstreamError("xBloom API returned a non-success HTTP status.", {
        status: response.status,
        body: text.slice(0, 500)
      });
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new UpstreamError("xBloom API returned invalid JSON.", { body: text.slice(0, 500) });
    }
  }

  rsaEncrypt(payload) {
    const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
    const chunkSize = 117;
    const encryptedChunks = [];

    for (let offset = 0; offset < plaintext.length; offset += chunkSize) {
      const chunk = plaintext.subarray(offset, offset + chunkSize);
      const encryptedChunk = publicEncrypt(
        { key: RSA_PUBLIC_KEY_PEM, padding: constants.RSA_PKCS1_PADDING },
        chunk
      );
      encryptedChunks.push(encryptedChunk);
    }

    return Buffer.concat(encryptedChunks).toString("base64");
  }
}
