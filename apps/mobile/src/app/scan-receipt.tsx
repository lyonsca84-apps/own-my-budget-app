import { router } from 'expo-router';
import { scanReceipt } from '@own-my-budget/api';

import { ScanPhotoScreen } from '@/components/grocery/scan-photo-screen';
import { scanHandoff } from '@/lib/scan-handoff';
import { supabase } from '@/lib/supabase';

export default function ScanReceiptScreen() {
  return (
    <ScanPhotoScreen
      feature="receiptScan"
      title="Scan receipt"
      subtitle="Take a photo or choose one from your library. You'll review and correct everything before it saves."
      tips={[
        'Lay the receipt flat and fill the frame.',
        'Use good light and avoid shadows across the text.',
        'Include the store name and the total.',
      ]}
      busyLabel="Reading your receipt…"
      guestTitle="Create an account to scan receipts"
      guestMessage="Scanning and saving receipts needs a free account so your items and totals stick around."
      run={async ({ base64, mediaType }) => {
        const extraction = await scanReceipt(supabase, base64, mediaType);
        scanHandoff.receipt = { extraction, imageBase64: base64, mediaType };
        router.replace('/review-receipt');
      }}
    />
  );
}
