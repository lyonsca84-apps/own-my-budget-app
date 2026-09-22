export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  /** Accessible name; drawn above the field unless `hideLabel`. */
  label: string;
  hideLabel?: boolean;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown while `value` matches no option (e.g. "Choose a payday"). */
  placeholder?: string;
  errorMessage?: string;
  disabled?: boolean;
  /** 44px-high, 15px-text variant for page headers (year / month selects). */
  compact?: boolean;
  /** Fixed outer width; default is "fill the parent". */
  width?: number;
}

export const CHEVRON_SIZE = 8;
