import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";

// Set a test encryption key before importing the module
beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("crypto", () => {
  it("encrypts and decrypts a string correctly", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const original = "my-secret-access-token-12345";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext for the same input (random IV)", async () => {
    const { encrypt } = await import("./crypto");
    const text = "same-input";
    const a = encrypt(text);
    const b = encrypt(text);
    expect(a).not.toBe(b);
  });

  it("returns payload in iv:tag:encrypted format", async () => {
    const { encrypt } = await import("./crypto");
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars, Tag = 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(24);
    expect(parts[1]).toHaveLength(32);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("throws on tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    // Flip a character in the encrypted data
    parts[2] = parts[2].replace(/^./, parts[2][0] === "a" ? "b" : "a");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("handles empty string", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode text", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const original = "日本語テスト🔑";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });
});
