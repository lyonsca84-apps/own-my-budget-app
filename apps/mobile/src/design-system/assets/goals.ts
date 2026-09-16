export const GoalAssets = {
  emergencyFund: require('@/assets/design-system/goals/emergency-fund.png'),
  familyVacation: require('@/assets/design-system/goals/family-vacation.png'),
  newLaptop: require('@/assets/design-system/goals/new-laptop.png'),
} as const;

export type GoalAssetName = keyof typeof GoalAssets;
