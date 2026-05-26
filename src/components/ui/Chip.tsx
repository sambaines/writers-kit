import { X } from '@phosphor-icons/react';
import styles from './Chip.module.css';

interface ChipProps {
  label: string;
  leadingIcon?: React.ReactNode;
  onRemove?: () => void;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

export default function Chip({
  label,
  leadingIcon,
  onRemove,
  color,
  backgroundColor,
  className,
}: ChipProps) {
  return (
    <span
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      style={{ color, backgroundColor }}
    >
      {leadingIcon && <span className={styles.icon}>{leadingIcon}</span>}
      <span className={styles.label}>{label}</span>
      {onRemove && (
        <button className={styles.remove} onClick={onRemove} type="button">
          <X size={10} weight="bold" />
        </button>
      )}
    </span>
  );
}
