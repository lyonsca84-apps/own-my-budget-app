import type { TypedSupabaseClient } from '../client';
import type { Tables, TablesInsert } from '../database.types';

export interface ReceiptItemInput {
  label: string;
  category: string | null;
  price_cents: number;
  quantity: number;
}

export interface SaveReceiptInput {
  user_id: string;
  store_label: string | null;
  purchased_on: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  image_storage_path: string | null;
  items: ReceiptItemInput[];
}

/**
 * Saves a receipt the user has already reviewed and corrected — this is
 * only ever called post-confirmation (PLAN.md screen #45: "nothing saves
 * until confirmed"), so the row is inserted as 'confirmed' directly rather
 * than round-tripping through 'pending'.
 */
export async function saveReceipt(
  client: TypedSupabaseClient,
  input: SaveReceiptInput
): Promise<Tables<'receipts'>> {
  const { data: receipt, error: receiptError } = await client
    .from('receipts')
    .insert({
      user_id: input.user_id,
      store_label: input.store_label,
      purchased_on: input.purchased_on,
      subtotal_cents: input.subtotal_cents,
      tax_cents: input.tax_cents,
      total_cents: input.total_cents,
      image_storage_path: input.image_storage_path,
      ai_extraction_status: 'confirmed',
    })
    .select()
    .single();
  if (receiptError) throw receiptError;

  if (input.items.length > 0) {
    const rows: TablesInsert<'receipt_items'>[] = input.items.map((item) => ({
      user_id: input.user_id,
      receipt_id: receipt.id,
      label: item.label,
      category: item.category,
      price_cents: item.price_cents,
      quantity: item.quantity,
    }));
    const { error: itemsError } = await client.from('receipt_items').insert(rows);
    if (itemsError) throw itemsError;
  }

  return receipt;
}

export async function listReceipts(
  client: TypedSupabaseClient,
  userId: string
): Promise<Tables<'receipts'>[]> {
  const { data, error } = await client
    .from('receipts')
    .select('*')
    .eq('user_id', userId)
    .order('purchased_on', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data;
}
