import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { EdgeFunctionError } from '@own-my-budget/api';

import { ThemedText } from '@/components/themed-text';
import { describeRemainingScans, useScanGate } from '@/components/grocery/use-scan-gate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GuestGate } from '@/components/ui/guest-gate';
import { LimitNotice } from '@/components/ui/limit-notice';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionCard } from '@/components/ui/section-card';
import { Space } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export interface PickedPhoto {
  base64: string;
  mediaType: string;
}

export interface ScanPhotoScreenProps {
  feature: 'receiptScan' | 'pantryScan';
  title: string;
  subtitle: string;
  tips: string[];
  busyLabel: string;
  guestTitle: string;
  guestMessage: string;
  /** Sends the photo to its edge function and navigates on success; throw to show an error. */
  run: (photo: PickedPhoto) => Promise<void>;
}

/**
 * The shared "take a photo or choose one" screen behind both receipt and
 * pantry scanning: plan-limit check, camera/library permission handling, the
 * busy state while the AI reads the photo, and calm error messages.
 */
export function ScanPhotoScreen({
  feature,
  title,
  subtitle,
  tips,
  busyLabel,
  guestTitle,
  guestMessage,
  run,
}: ScanPhotoScreenProps) {
  const { status, user } = useAuth();
  const { gate, loadFailed } = useScanGate(feature);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limitReason, setLimitReason] = useState<string | null>(null);

  async function handlePick(source: 'camera' | 'library') {
    if (!user || !gate?.allowed) return;
    setErrorMessage(null);
    setLimitReason(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage(
        source === 'camera'
          ? 'We need camera access to take a photo. You can also choose one from your library, or allow camera access in Settings.'
          : 'We need access to your photos to choose one. You can also take a photo, or allow photo access in Settings.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            base64: true,
            quality: 0.7,
          });
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    setIsScanning(true);
    try {
      await run({ base64: asset.base64!, mediaType: asset.mimeType ?? 'image/jpeg' });
    } catch (error) {
      if (error instanceof EdgeFunctionError && error.code === 'usage_limit') {
        setLimitReason(error.message);
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : 'Something went wrong. Please try again.'
        );
      }
    } finally {
      setIsScanning(false);
    }
  }

  if (status !== 'signedIn') {
    return <GuestGate title={guestTitle} message={guestMessage} />;
  }

  const blocked = gate !== null && !gate.allowed;
  const remaining = describeRemainingScans(gate);

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <ScreenHeader title={title} subtitle={subtitle} />

      {blocked && gate?.reason ? <LimitNotice reason={gate.reason} /> : null}
      {limitReason ? <LimitNotice reason={limitReason} /> : null}

      <Card style={{ gap: Space[4] }}>
        {isScanning ? (
          <View style={{ alignItems: 'center', gap: Space[3], paddingVertical: Space[5] }}>
            <ActivityIndicator />
            <ThemedText accessibilityLiveRegion="polite">{busyLabel}</ThemedText>
          </View>
        ) : (
          <>
            <View style={{ gap: Space[3] }}>
              <Button
                label="Take a photo"
                onPress={() => handlePick('camera')}
                disabled={!gate?.allowed}
              />
              <Button
                label="Choose from library"
                variant="secondary"
                onPress={() => handlePick('library')}
                disabled={!gate?.allowed}
              />
            </View>
            {remaining ? (
              <ThemedText type="small" themeColor="textSecondary">
                {remaining}
              </ThemedText>
            ) : null}
            {loadFailed && !gate ? (
              <ThemedText type="small" themeColor="warning">
                We couldn&rsquo;t check your scan allowance just now. Go back and try again in a
                moment.
              </ThemedText>
            ) : null}
          </>
        )}

        {errorMessage ? (
          <ThemedText type="small" themeColor="warning" accessibilityLiveRegion="polite">
            {errorMessage}
          </ThemedText>
        ) : null}
      </Card>

      <SectionCard title="For the best result">
        <View style={{ gap: Space[2] }}>
          {tips.map((tip) => (
            <ThemedText key={tip} type="small" themeColor="textSecondary">
              • {tip}
            </ThemedText>
          ))}
        </View>
      </SectionCard>
    </Screen>
  );
}
