import { describe, expect, test } from 'vitest';
import { arrayBufferToBase64 } from '../optimizedAI';

describe('arrayBufferToBase64', () => {
  test('encodes large buffers correctly', async () => {
    const buffer = new Uint8Array(1024 * 1024).fill(1).buffer; // 1MB
    const result = await arrayBufferToBase64(buffer);
    const expected = Buffer.from(new Uint8Array(buffer)).toString('base64');
    expect(result).toBe(expected);
  });
});
