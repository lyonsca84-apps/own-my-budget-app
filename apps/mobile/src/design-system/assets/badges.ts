export const BadgeAssets = {
  billBoss: require('@/assets/design-system/badges/bill-boss.png'),
  budgetBuilder: require('@/assets/design-system/badges/budget-builder.png'),
  challengeMaster: require('@/assets/design-system/badges/challenge-master.png'),
  challengeStarter: require('@/assets/design-system/badges/challenge-starter.png'),
  debtCrusher: require('@/assets/design-system/badges/debt-crusher.png'),
  emergencyReady: require('@/assets/design-system/badges/emergency-ready.png'),
  firstDeposit: require('@/assets/design-system/badges/first-deposit.png'),
  goalGetter: require('@/assets/design-system/badges/goal-getter.png'),
  paycheckPlanner: require('@/assets/design-system/badges/paycheck-planner.png'),
  quarterComplete: require('@/assets/design-system/badges/quarter-complete.png'),
  savingsStarter: require('@/assets/design-system/badges/savings-starter.png'),
  streakSaver: require('@/assets/design-system/badges/streak-saver.png'),
} as const;

export type BadgeName = keyof typeof BadgeAssets;
