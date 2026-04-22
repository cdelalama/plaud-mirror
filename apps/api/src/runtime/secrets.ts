import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface EncryptedPayload {
  version: number;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface StoredSecrets {
  accessToken: string | null;
  webhookSecret: string | null;
}

const EMPTY_SECRETS: StoredSecrets = {
  accessToken: null,
  webhookSecret: null,
};

export class SecretStore {
  private readonly filePath: string;
  private readonly key: Buffer;

  constructor(filePath: string, masterKey: string) {
    this.filePath = filePath;
    this.key = createHash("sha256").update(masterKey, "utf8").digest();
  }

  async load(): Promise<StoredSecrets> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const payload = JSON.parse(raw) as EncryptedPayload;
      return normalizeSecrets(this.decrypt(payload));
    } catch (error) {
      if (isFileNotFound(error)) {
        return { ...EMPTY_SECRETS };
      }

      throw error;
    }
  }

  async save(secrets: StoredSecrets): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload = this.encrypt(normalizeSecrets(secrets));
    await writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  async update(partial: Partial<StoredSecrets>): Promise<StoredSecrets> {
    const next = {
      ...(await this.load()),
      ...partial,
    };

    const normalized = normalizeSecrets(next);
    await this.save(normalized);
    return normalized;
  }

  private encrypt(secrets: StoredSecrets): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from("plaud-mirror-secrets-v1", "utf8"));

    const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return {
      version: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  private decrypt(payload: EncryptedPayload): StoredSecrets {
    if (payload.version !== 1) {
      throw new Error(`Unsupported encrypted secrets version: ${payload.version}`);
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAAD(Buffer.from("plaud-mirror-secrets-v1", "utf8"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString("utf8")) as StoredSecrets;
  }
}

function normalizeSecrets(input: Partial<StoredSecrets>): StoredSecrets {
  return {
    accessToken: input.accessToken?.trim() || null,
    webhookSecret: input.webhookSecret?.trim() || null,
  };
}

function isFileNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
