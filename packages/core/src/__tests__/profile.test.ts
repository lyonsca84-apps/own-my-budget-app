import {
  AGE_RANGES,
  PROFILE_IMAGE_MAX_BYTES,
  detectImageType,
  isAgeRange,
  validateProfileImage,
} from '../profile';

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]);
const TEXT = new Uint8Array(ascii('hello, not an image'));

describe('age ranges', () => {
  it('are optional bands, never a birth date', () => {
    expect(AGE_RANGES.map((r) => r.value)).toEqual([
      'under_18',
      '18_24',
      '25_34',
      '35_44',
      '45_54',
      '55_64',
      '65_plus',
    ]);
    expect(isAgeRange('25_34')).toBe(true);
    expect(isAgeRange('1990-01-01')).toBe(false);
    expect(isAgeRange(null)).toBe(false);
  });
});

describe('profile image checks', () => {
  it('detects PNG, JPEG and WebP from their first bytes', () => {
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(WEBP)).toBe('image/webp');
    expect(detectImageType(TEXT)).toBeNull();
  });

  it('accepts real images with matching type and name', () => {
    expect(
      validateProfileImage({ mimeType: 'image/png', fileName: 'logo.png', bytes: PNG })
    ).toEqual({ ok: true, contentType: 'image/png', extension: 'png' });
    expect(
      validateProfileImage({ mimeType: 'image/jpeg', fileName: 'me.JPG', bytes: JPEG }).ok
    ).toBe(true);
    expect(validateProfileImage({ bytes: WEBP }).ok).toBe(true);
  });

  it('rejects empty, oversized, non-image and mislabeled files', () => {
    expect(validateProfileImage({ bytes: new Uint8Array() }).ok).toBe(false);
    const big = new Uint8Array(PROFILE_IMAGE_MAX_BYTES + 1);
    big.set(PNG);
    expect(validateProfileImage({ bytes: big })).toEqual({
      ok: false,
      message: 'That image is larger than 5 MB. Please choose a smaller one.',
    });
    expect(validateProfileImage({ mimeType: 'image/png', fileName: 'x.png', bytes: TEXT }).ok).toBe(
      false
    );
    expect(validateProfileImage({ mimeType: 'image/png', bytes: JPEG }).ok).toBe(false);
    expect(validateProfileImage({ fileName: 'logo.gif', bytes: PNG }).ok).toBe(false);
  });
});
