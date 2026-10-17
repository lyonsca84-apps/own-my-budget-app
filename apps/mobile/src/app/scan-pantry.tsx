import { router } from 'expo-router';
import { scanPantry } from '@own-my-budget/api';

import { ScanPhotoScreen } from '@/components/grocery/scan-photo-screen';
import { scanHandoff } from '@/lib/scan-handoff';
import { supabase } from '@/lib/supabase';

export default function ScanPantryScreen() {
  return (
    <ScanPhotoScreen
      feature="pantryScan"
      title="Scan pantry"
      subtitle="We'll suggest what looks low or missing — you pick what goes on your grocery list."
      tips={[
        'Open the fridge or pantry door fully and step back.',
        'Make sure shelves are well lit and labels face out.',
        'One shelf or section per photo works best.',
      ]}
      busyLabel="Looking at your photo…"
      guestTitle="Create an account to scan your pantry"
      guestMessage="Scanning your pantry or fridge needs a free account so we can save what we find."
      run={async ({ base64, mediaType }) => {
        const extraction = await scanPantry(supabase, base64, mediaType);
        scanHandoff.pantry = { extraction };
        router.replace('/review-pantry');
      }}
    />
  );
}
