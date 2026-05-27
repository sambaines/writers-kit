import { Check, Prohibit } from '@phosphor-icons/react';
import IconWrapper from './IconWrapper';
import styles from './SelectOption.module.css';

interface SelectOptionProps {
  label: string;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  iconColor?: string;
  labelColor?: string;
  onClick?: () => void;
}

export default function SelectOption({
  label,
  icon,
  trailingIcon,
  selected,
  disabled,
  iconColor,
  labelColor,
  onClick,
}: SelectOptionProps) {
  const trailing = trailingIcon
    ? trailingIcon
    : selected
    ? <Check size={12} />
    : disabled
    ? <Prohibit size={12} />
    : null;

  return (
    <div
      className={`${styles.root}${selected ? ` ${styles.selected}` : ''}${disabled ? ` ${styles.disabled}` : ''}`}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      onClick={!disabled ? onClick : undefined}
    >
      <span className={styles.leading}>
        {icon && (
          <IconWrapper size={16}>
            <span style={iconColor ? { color: iconColor } : undefined}>{icon}</span>
          </IconWrapper>
        )}
        <span className={styles.label} style={labelColor ? { color: labelColor } : undefined}>
          {label}
        </span>
      </span>
      {trailing && (
        <IconWrapper size={16}>
          <span style={iconColor ? { color: iconColor } : undefined}>{trailing}</span>
        </IconWrapper>
      )}
    </div>
  );
}
