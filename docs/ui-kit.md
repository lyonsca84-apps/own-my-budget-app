# UI kit (components/ui)

Shared building blocks for the pages built to the approved Claude design
(`design/App Screenshots/`). Everything reads colors from `useTheme()` /
`constants/theme.ts` — never hard-code hex in a screen. Import paths are
`@/components/ui/<file>`.

Web accessibility note: this React Native Web version does **not** translate
`accessibilityState` into ARIA attributes. Use `aria-selected`, `aria-checked`,
`aria-expanded`, `aria-disabled`, `aria-busy` props (they work on native too),
as the kit components do.

## Dialogs — `dialog.tsx`

Every "add / plan / log" screen is a route modal. `DialogScreen` is the body:
on wide web (>= `Layout.sidebarBreakpoint`, 900px) a centered white card
(radius 24, padding 28, 560px / 720px) over a dimmed backdrop with the previous
page visible; scrollable body, sticky footer, backdrop click / Escape close,
focus moves in and is trapped, `role="dialog"` + `aria-modal` + labelled by the
title, fade (plus a 10px rise unless reduced-motion). On native and narrow web
it is a full-height sheet under the standard header (the header shows `title`).

```tsx
import { DialogScreen } from '@/components/ui/dialog';

<DialogScreen
  title="Plan payment — Rent"
  subtitle="Choose which paycheck(s) will cover this."
  primaryLabel="Save plan"
  onPrimary={handleSave}
  primaryDisabled={!valid}
  busy={isSubmitting}
  errorMessage={errorMessage} // clay text above the footer
  // secondaryLabel="Cancel"    // default; `null` hides it
  // onClose={...}              // default: router.back() (or '/' when opened cold)
  // size="lg"                  // 720px card (long forms, 52-week challenge)
  // footer={<>…</>}            // replaces the Cancel + primary row entirely
>
  {fields}
</DialogScreen>;
```

Also exported: `closeDialogRoute()` (call after a successful save; same as the
default Cancel).

### Converting a route screen to the dialog

1. Replace `<Screen>…<Button label="Save"/></Screen>` with `<DialogScreen …>`;
   move the save `Button` to `primaryLabel` / `onPrimary`, and the error `Text`
   to `errorMessage`. Delete the screen's own Cancel button.
2. Use the form kit below for fields (`DateField`, `SelectField`, notes
   `TextField rows={3}`, …). Lay two-up rows out with
   `<View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}>…`.
3. In `app/_layout.tsx` add the route's name to the `DIALOG_SCREENS` set (one
   line each). That is what switches the route to
   `presentation: 'transparentModal'` + `animation: 'fade'` on web, with
   `headerShown` false on wide web. **Do this only once the screen renders `DialogScreen`** — an
   unconverted screen would lose its header on wide web.
4. After saving, call `router.back()` / `closeDialogRoute()` as before.

Notes: on web, `transparentModal` is supported by this Expo Router / React
Navigation stack (the previous route stays mounted and visible). Deep-linking
straight to a modal URL still bounces through the auth guard to `/` (existing
behavior, unchanged).

## Buttons — `button.tsx`

`<Button label variant size shape loading style … />` (all Pressable props).

| variant             | look                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `primary` (default) | filled brand blue                                                  |
| `panel`             | filled Panel navy ("Manage payments")                              |
| `soft`              | light-gray fill, dark text — dialog Cancel, "Plan payment", "Edit" |
| `outline`           | transparent, control border, dark text ("View details")            |
| `secondary`         | legacy alias of `outline` (66 call sites use it; look unchanged)   |
| `quiet`             | blue text only                                                     |
| `danger`            | filled clay                                                        |
| `dangerOutline`     | clay text + clay border ("Delete")                                 |
| `dangerQuiet`       | clay text only (inline "Delete")                                   |

`size`: `md` (52px, default) or `sm` (40px, for rows/cards). `shape`: `pill`
(default) or `rounded` (12px radius — what dialogs and row actions use in the
design). `loading` shows a spinner and blocks presses. `style` is layout-only
(`flex: 1`, margins).

```tsx
<Button label="Log payment" size="sm" shape="rounded" onPress={…} />
<Button label="Plan payment" size="sm" shape="rounded" variant="soft" />
<Button label="Delete" size="sm" shape="rounded" variant="dangerOutline" />
```

## Form kit

All fields share one look (52px, 12px radius, 1.5px control border, blue focus
ring, `dangerSolid` error border).

- **`TextField`** (`text-field.tsx`) — existing props plus `hideLabel` (label
  stays the accessible name, not drawn — for placeholder-as-label fields),
  `rows` (multi-line notes box `rows` lines tall), `helperText`.
  ```tsx
  <TextField
    label="Notes"
    hideLabel
    placeholder="Notes (optional)"
    rows={3}
    value={n}
    onChangeText={setN}
  />
  ```
- **`SelectField`** (`select-field.tsx`) — props: `label`, `value`,
  `onChange(value)`, `options` (`{value,label,disabled?}[]`), `placeholder?`,
  `hideLabel?`, `errorMessage?`, `disabled?`, `compact?`, `width?`. Web: a real styled `<select>` with a chevron.
  Native: field opening a bottom-sheet list. Values are strings; use a sentinel
  (e.g. `'__none__'`) for a "None" option — `''` means "no selection".
  `compact` (44px / 15px text) + `hideLabel` is the page-header year/month select.
  ```tsx
  <SelectField
    label="Payday"
    value={payday}
    onChange={setPayday}
    placeholder="Choose a payday"
    options={paydays.map((p) => ({ value: p.id, label: p.label }))}
  />
  ```
- **`DateField`** (`date-field.tsx`) — props: `label`, `value` (`'YYYY-MM-DD'`
  or `''`), `onChange`, `hideLabel?`, `errorMessage?`, `disabled?`, `min?`,
  `max?`. Web: styled
  `<input type="date">`. Native: `YYYY-MM-DD` text field that validates on blur
  (no native date-picker dependency is installed). `isValidIsoDate(str)` is
  exported for submit-time checks.
- **`SwatchPicker`** (`swatch-picker.tsx`) — props: `colors`, `value`,
  `onChange`, `label`, `size?`, `names?`; radiogroup of circles, selected one gets a navy ring.
  `GOAL_SWATCHES` is the design's 5-color palette.
- **`CheckboxField`** (`checkbox-field.tsx`) — props: `label`, `checked`,
  `onChange`, `disabled?`, `subtle?` (`subtle` = gray small label, the "Remind" checkbox).
  Role `checkbox`; toggles with Space and Enter on web.

## Status pills — `status-pill.tsx`

`<StatusPill label tone filled? />`. `filled` = the design's solid-fill look
(saturated background, white text, 8px radius); default is the soft tinted pill.

| tone      | filled color  | typical labels                     |
| --------- | ------------- | ---------------------------------- |
| `success` | green         | Paid, Completed, Reached           |
| `warning` | mustard/olive | Due, Upcoming, Needs Attention     |
| `info`    | blue          | Partial, Partially Paid            |
| `danger`  | clay (rust)   | Overdue, Past Due, Behind Schedule |
| `accent`  | teal          | On Track                           |
| `neutral` | gray          | Paused, Not Started                |

`danger` is clay (`theme.clay` / `theme.solidDanger`), never red. New theme
tokens (light + dark): `clay`, `clayMuted`, `solidSuccess`, `solidWarning`,
`solidInfo`, `solidDanger`, `solidAccent`, `onSolid` — every solid clears AA
with `onSolid` text.

## Tabs / segmented control — `segmented-control.tsx`

`<SegmentedControl options value onChange variant size fullWidth accessibilityLabel />`

- `variant="tabs"` (or `<PageTabs …/>`): white rounded bar, blue selected pill —
  Monthly/Paycheck budget, Bills sub-tabs. Scrolls sideways when too wide.
- `variant="soft"` + `size="sm"`: gray track, blue pill — Snowball/Avalanche,
  All/Deposits/Goals.
- `variant="chips"`: separate tinted pills, blue when selected — the loan filter row.
- `variant="panel"` (default): legacy gray track + navy pill.

```tsx
<PageTabs
  value={tab}
  onChange={setTab}
  options={[
    { value: 'monthly', label: 'Monthly budget' },
    { value: 'pay', label: 'Paycheck budget' },
  ]}
/>
```

## Page header — `page-header.tsx`

```tsx
<PageHeader
  title="Budget"
  subtitle="Plan by month or by paycheck."
  backLink={{ label: 'Back to Dashboard', href: '/' }}   // optional
  right={<>
    <View style={{ width: 120 }}><SelectField label="Year" hideLabel compact … /></View>
    <Button label="+ New Goal" size="sm" shape="rounded" />
  </>}
/>
```

24px bold title, gray subtitle, right slot wraps under the title on narrow screens.

## Chrome

- **Sidebar** (`components/app-tabs.web.tsx`, also used by `wide-sidebar-frame.web.tsx`):
  logo, 16px nav items with dot + gray active pill, teal-to-blue Budget Buddy card
  (data-driven trial copy from `PLAN_PRICING`) with a white CTA, and the Guest
  Mode block (gradient orb, "Guest Mode / Demo data"; tapping still exits guest mode).
- **`GuestBanner`** — navy bar, green "Create free account →" link. Rendered by
  `<Screen showGuestBanner>`.
- **Budget Buddy button** (`components/helper/budget-buddy-fab.tsx`) — blue gradient circle, white ✦.
- `Layout.sidebarBreakpoint` (900) is the single breakpoint for sidebar vs. bottom tabs and dialog card vs. sheet.
