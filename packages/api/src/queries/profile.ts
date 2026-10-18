import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesUpdate } from '../database.types';

export async function getProfile(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'profiles'>> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  client: TypedSupabaseClient,
  userId: string,
  updates: TablesUpdate<'profiles'>
): Promise<Tables<'profiles'>> {
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Private bucket for profile photos and household/business logos. */
export const PROFILE_IMAGES_BUCKET = 'profile-images';

export type ProfileImageColumn = 'avatar_path' | 'logo_path';

function columnFor(kind: 'avatar' | 'logo'): ProfileImageColumn {
  return kind === 'avatar' ? 'avatar_path' : 'logo_path';
}

/**
 * Uploads a new profile photo or logo to "{userId}/{kind}-{timestamp}.{ext}",
 * points the profile at it, then removes the previous file. The previous image
 * stays in place until the new one is stored and saved. Ownership is enforced
 * by the bucket policies and the profiles path check, not by this argument.
 */
export async function uploadProfileImage(
  client: TypedSupabaseClient,
  userId: string,
  kind: 'avatar' | 'logo',
  bytes: Uint8Array,
  contentType: string,
  extension: string
): Promise<Tables<'profiles'>> {
  const column = columnFor(kind);
  const previous = (await getProfile(client, userId))[column];
  const path = `${userId}/${kind}-${Date.now()}.${extension}`;

  const { error: uploadError } = await client.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) throw uploadError;

  let updated: Tables<'profiles'>;
  try {
    updated = await updateProfile(client, userId, { [column]: path });
  } catch (error) {
    await client.storage.from(PROFILE_IMAGES_BUCKET).remove([path]);
    throw error;
  }
  if (previous && previous !== path) {
    // Best effort: the profile already points at the new image.
    await client.storage.from(PROFILE_IMAGES_BUCKET).remove([previous]);
  }
  return updated;
}

/** Clears the photo or logo from the profile, then deletes its file. */
export async function removeProfileImage(
  client: TypedSupabaseClient,
  userId: string,
  kind: 'avatar' | 'logo'
): Promise<Tables<'profiles'>> {
  const column = columnFor(kind);
  const previous = (await getProfile(client, userId))[column];
  const updated = await updateProfile(client, userId, { [column]: null });
  if (previous) await client.storage.from(PROFILE_IMAGES_BUCKET).remove([previous]);
  return updated;
}

/** A short-lived link for showing a private profile image; null if it can't be made. */
export async function getProfileImageUrl(
  client: TypedSupabaseClient,
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(PROFILE_IMAGES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}
