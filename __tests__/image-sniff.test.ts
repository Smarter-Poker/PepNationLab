import { describe, it, expect } from 'vitest';
import { sniffImageMime, EXT_BY_MIME, ALLOWED_IMAGE_MIME } from '@/lib/image-sniff';

const bytesFrom = (...vals: number[]) => new Uint8Array(vals);

describe('sniffImageMime', () => {
  it('detects JPEG (FF D8 FF)', () => {
    expect(sniffImageMime(bytesFrom(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toBe('image/jpeg');
  });

  it('detects PNG signature', () => {
    expect(sniffImageMime(bytesFrom(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe('image/png');
  });

  it('detects GIF87a and GIF89a', () => {
    expect(sniffImageMime(bytesFrom(0x47, 0x49, 0x46, 0x38, 0x37, 0x61))).toBe('image/gif');
    expect(sniffImageMime(bytesFrom(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif');
  });

  it('detects WEBP (RIFF....WEBP)', () => {
    const webp = bytesFrom(
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50  // WEBP
    );
    expect(sniffImageMime(webp)).toBe('image/webp');
  });

  it('rejects non-image bytes (e.g. an HTML/script payload)', () => {
    // "<script>" leading bytes
    expect(sniffImageMime(bytesFrom(0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74))).toBeNull();
  });

  it('rejects a PDF masquerading as an image', () => {
    // "%PDF-1.7"
    expect(sniffImageMime(bytesFrom(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37))).toBeNull();
  });

  it('rejects truncated / empty input safely', () => {
    expect(sniffImageMime(bytesFrom())).toBeNull();
    expect(sniffImageMime(bytesFrom(0xff, 0xd8))).toBeNull(); // 2 bytes, not enough for JPEG
    expect(sniffImageMime(bytesFrom(0x52, 0x49, 0x46, 0x46))).toBeNull(); // RIFF without WEBP tag
  });

  it('maps every allowed MIME to an extension', () => {
    for (const mime of ALLOWED_IMAGE_MIME) {
      expect(EXT_BY_MIME[mime]).toBeTruthy();
    }
  });
});
