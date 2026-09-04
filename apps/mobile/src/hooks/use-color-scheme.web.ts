import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

function subscribe(onChange: () => void) {
  const listener = Appearance.addChangeListener(onChange);
  return () => listener.remove();
}

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * `useSyncExternalStore`'s server snapshot ('light') is what gets statically rendered; the client
 * snapshot then reconciles to the real OS scheme post-hydration, without a setState-in-effect.
 */
export function useColorScheme() {
  return useSyncExternalStore(
    subscribe,
    () => Appearance.getColorScheme() ?? 'light',
    () => 'light'
  );
}
