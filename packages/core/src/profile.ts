/**
 * Profile details the Settings page can collect, and the rules for the
 * optional profile photo and household/business logo uploads.
 *
 * - Age is an optional band (never a birth date), used only to tailor
 *   educational content. Skipping it never limits the app.
 * - Images are checked by declared type, extension, size AND their first
 *   bytes, so a renamed file can't slip through as an image.
 */

export const AGE_RANGES = [
  { value: 'under_18', label: 'Under 18' },
  { value: '18_24', label: '18–24' },
  { value: '25_34', label: '25–34' },
  { value: '35_44', label: '35–44' },
  { value: '45_54', label: '45–54' },
  { value: '55_64', label: '55–64' },
  { value: '65_plus', label: '65 or older' },
] as const;

export type AgeRange = (typeof AGE_RANGES)[number]['value'];

export function isAgeRange(value: unknown): value is AgeRange {
  return AGE_RANGES.some((range) => range.value === value);
}

export type ProfileImageKind = 'avatar' | 'logo';
export type ProfileImageType = 'image/png' | 'image/jpeg' | 'image/webp';

/** 5 MB, matching the storage bucket's own limit. */
export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<ProfileImageType, string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
};

/** What the file's first bytes say it is (PNG, JPEG or WebP), or null. */
export function detectImageType(bytes: Uint8Array): ProfileImageType | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(at(0), at(1), at(2), at(3)) === 'RIFF' &&
    String.fromCharCode(at(8), at(9), at(10), at(11)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export type ProfileImageCheck =
  { ok: true; contentType: ProfileImageType; extension: string } | { ok: false; message: string };

/**
 * Checks a picked file before upload. `mimeType`/`fileName` may be missing on
 * some platforms; the decoded bytes are always checked.
 */
export function validateProfileImage(file: {
  mimeType?: string | null;
  fileName?: string | null;
  bytes: Uint8Array;
}): ProfileImageCheck {
  const size = file.bytes.length;
  if (size === 0) return { ok: false, message: 'That file is empty. Please choose another image.' };
  if (size > PROFILE_IMAGE_MAX_BYTES) {
    return { ok: false, message: 'That image is larger than 5 MB. Please choose a smaller one.' };
  }
  const detected = detectImageType(file.bytes);
  if (!detected) {
    return { ok: false, message: 'Please choose a PNG, JPG or WebP image.' };
  }
  const declared = file.mimeType?.toLowerCase();
  if (
    declared &&
    declared !== detected &&
    !(declared === 'image/jpg' && detected === 'image/jpeg')
  ) {
    return { ok: false, message: 'That file doesn’t look like the image type it claims to be.' };
  }
  const name = file.fileName ?? '';
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined;
  if (ext && !EXTENSIONS[detected].includes(ext)) {
    return { ok: false, message: 'The file name doesn’t match a PNG, JPG or WebP image.' };
  }
  return { ok: true, contentType: detected, extension: EXTENSIONS[detected][0] };
}
