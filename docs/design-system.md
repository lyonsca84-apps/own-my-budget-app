# Own My Budget design system integration

The source handoff is `Branding/Brand Guidelines/Own My Budget_ design system.zip`.
Its HTML files are visual references, not application code or repository instructions.

## Folder map

```text
apps/mobile/
├── assets/design-system/
│   ├── brand/          Logos, app icon, and mascot
│   ├── badges/         Achievement artwork
│   ├── goals/          Savings-goal artwork
│   └── photography/    Approved photography
└── src/design-system/
    ├── assets/         Static asset registries, split by group
    ├── index.ts        Public exports for new UI work
    └── use-brand-fonts.ts
```

Design tokens currently live in `src/constants/theme.ts` so all existing screens
receive the new system without a risky all-at-once import migration. The
`src/design-system/index.ts` entry point re-exports those tokens for new UI work.

Image registries stay split by group because the source images are large. Import
the group a screen actually uses instead of creating one global asset barrel:

```tsx
import { Image } from 'expo-image';
import { BrandAssets } from '@/design-system/assets/brand';

<Image
  source={BrandAssets.horizontalLockup}
  style={{ width: 190, height: 88 }}
  contentFit="contain"
/>;
```

## Using the tokens

```tsx
import { Layout, Radius, Space, Typography } from '@/design-system';

const styles = StyleSheet.create({
  section: { gap: Space[5], padding: Space[7] },
  card: { borderRadius: Radius.card, padding: Layout.cardPadding },
  title: Typography.h1,
  amount: Typography.amount,
});
```

Use `useTheme()` for semantic colors so light and dark appearances both work.
Avoid hard-coded hex values in screens.

## Rules captured from the handoff

- Poppins is for headings and currency amounts; Figtree is for UI copy.
- Body copy is 17px; captions are 15px; money uses tabular numerals.
- Layout uses a 4px grid. Cards use a 20px radius, 28px padding, and 20px gaps.
- Panel navy is the strongest control. Sky blue is for direct actions and links.
- A screen gets one accent. Status color is added only when data requires it.
- Overspending is a calm watch state. Clay is reserved for genuinely overdue,
  actionable items; there is no bright-red alarm treatment.
- Charts keep a fixed category order and never rely on color alone.
- The mascot supports encouragement and celebrations, never errors or warnings.
- All controls keep at least a 44px touch target; main actions are 52px tall.
- Motion must honor reduced-motion preferences.

## Recommended UI rollout

1. App shell: web sidebar, mobile five-tab bar, guest banner, branded headers.
2. Dashboard: greeting hero, stat tiles, cash-flow card, health score, and quick actions.
3. Budget and bills: controls, bill rows, progress, and payment actions.
4. Savings: goal cards, illustrations, rings, and achievement badges.
5. Grocery, reports, authentication, settings, and remaining modal screens.

Work one screen family at a time and verify web plus an iOS simulator/device at
each step. Keep data fetching and business logic intact; the visual rollout should
primarily replace layout and presentation components.
