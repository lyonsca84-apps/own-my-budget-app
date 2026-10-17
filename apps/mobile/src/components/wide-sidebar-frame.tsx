import type { PropsWithChildren } from 'react';

/**
 * Native has no persistent sidebar, so screens that live outside the tab
 * shell (Grocery, Reports) render as-is. The web build swaps this for the
 * real frame — see wide-sidebar-frame.web.tsx.
 */
export function WideSidebarFrame({ children }: PropsWithChildren) {
  return <>{children}</>;
}
