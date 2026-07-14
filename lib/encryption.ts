import CryptoJS from "crypto-js";

export function encrypt(text: string): string {
  const key = process.env.SMTP_ENCRYPTION_KEY;
  if (!key) throw new Error("SMTP_ENCRYPTION_KEY is not configured");
  return CryptoJS.AES.encrypt(text, key).toString();
}

export function decrypt(ciphertext: string): string {
  const key = process.env.SMTP_ENCRYPTION_KEY;
  if (!key) throw new Error("SMTP_ENCRYPTION_KEY is not configured");
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return "";
  }
}
