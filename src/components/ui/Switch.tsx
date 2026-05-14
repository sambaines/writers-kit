import * as RadixSwitch from '@radix-ui/react-switch';
import styles from './Switch.module.css';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export default function Switch({ checked, onCheckedChange, disabled, id, 'aria-label': ariaLabel }: SwitchProps) {
  return (
    <RadixSwitch.Root
      className={styles.track}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      id={id}
      aria-label={ariaLabel}
    >
      <RadixSwitch.Thumb className={styles.handle} />
    </RadixSwitch.Root>
  );
}
