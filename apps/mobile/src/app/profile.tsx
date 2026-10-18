import { Redirect } from 'expo-router';

/**
 * Profile now lives in Settings → Profile (one profile screen, not two).
 * This route keeps older links and the More tab's Profile entry working.
 */
export default function ProfileScreen() {
  return <Redirect href="/settings?section=profile" />;
}
