"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.hashForLog = hashForLog;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
/** Derive a 32-byte key from API_KEY_SECRET for AES-256-GCM. */
function getKey() {
    const secret = env_1.env.API_KEY_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('API_KEY_SECRET is missing or invalid. Set a secure environment variable with at least 32 characters.');
    }
    return crypto_1.default.createHash('sha256').update(secret, 'utf8').digest();
}
function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}
function decrypt(ciphertext) {
    const key = getKey();
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < IV_LENGTH + TAG_LENGTH) {
        throw new Error('Invalid ciphertext');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
function hashForLog(value) {
    if (!value || value.length < 8)
        return '[redacted]';
    return value.slice(0, 4) + '…' + value.slice(-2);
}
//# sourceMappingURL=encryption.js.map