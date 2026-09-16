import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getCurrentAccount, getFeatureUsageCount, scanPantry } from '@own-my-budget/api';
import {
  evaluateFeatureGate,
  getUsagePeriodStart,
  FEATURE_REGISTRY,
  type FeatureGateResult,
  type PlanTier,
} from '@own-my-budget/core';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GuestGate } from '@/components/ui/guest-gate';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { scanHandoff } from '@/lib/scan-handoff';
import { Space } from '@/constants/theme';

export default function ScanPantryScreen() {
  const { status, user } = useAuth();
  const [gate, setGate] = useState<FeatureGateResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reloadGate = useCallback(async () => {
    if (status !== 'signedIn' || !user) return;
    const account = await getCurrentAccount(supabase, user.id);
    const plan = account.entitlement.plan_tier as PlanTier;
    const limit = FEATURE_REGISTRY.pantryScan.limits[plan];
    const periodStart = getUsagePeriodStart(
      limit.kind === 'count' ? (limit.period ?? 'lifetime') : 'lifetime'
    );
    const currentUsage = await getFeatureUsageCount(supabase, user.id, 'pantryScan', periodStart);
    setGate(evaluateFeatureGate('pantryScan', { plan, currentUsage }));
  }, [status, user]);

  useFocusEffect(
    useCallback(() => {
      reloadGate();
    }, [reloadGate])
  );

  async function handlePick(source: 'camera' | 'library') {
    if (!user || !gate?.allowed) return;
    setErrorMessage(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage('Permission was not granted.');
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
    const mediaType = asset.mimeType ?? 'image/jpeg';

    setIsScanning(true);
    try {
      const extraction = await scanPantry(supabase, asset.base64!, mediaType);
      scanHandoff.pantry = { extraction };
      router.replace('/review-pantry');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsScanning(false);
    }
  }

  if (status !== 'signedIn') {
    return (
      <GuestGate
        title="Create an account to scan your pantry"
        message="Scanning your pantry or fridge needs a free account so we can save what we find."
      />
    );
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        We&rsquo;ll suggest what looks low or missing — you pick what goes on your grocery list.
      </ThemedText>

      {gate && !gate.allowed ? (
        <Card>
          <ThemedText themeColor="danger">{gate.reason}</ThemedText>
        </Card>
      ) : gate ? (
        <ThemedText type="small" themeColor="textSecondary">
          {gate.kind === 'count' && gate.remaining !== undefined
            ? `${gate.remaining} scan${gate.remaining === 1 ? '' : 's'} remaining`
            : null}
        </ThemedText>
      ) : null}

      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}

      {isScanning ? (
        <View style={{ alignItems: 'center', padding: Space[5] }}>
          <ActivityIndicator />
          <ThemedText style={{ marginTop: Space[2] }}>Looking at your photo…</ThemedText>
        </View>
      ) : (
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
      )}
    </Screen>
  );
}
