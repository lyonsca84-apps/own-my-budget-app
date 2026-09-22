import { DialogSheet, type DialogScreenProps } from '@/components/ui/dialog-sheet';

export type { DialogScreenProps } from '@/components/ui/dialog-sheet';
export { closeDialogRoute } from '@/components/ui/dialog-sheet';

/**
 * The body of every "add / plan / log" route modal. Native: a full-height
 * sheet under the standard header. On web `dialog.web.tsx` swaps in the
 * centered card over a dimmed backdrop (wide screens) — same props.
 *
 * See docs/ui-kit.md for the conversion recipe.
 */
export function DialogScreen(props: DialogScreenProps) {
  return <DialogSheet {...props} />;
}
