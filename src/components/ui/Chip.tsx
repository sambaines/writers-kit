import { X } from '@phosphor-icons/react';
import IconLabel from './IconLabel';
import IconWrapper from './IconWrapper';
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
      <IconLabel icon={leadingIcon} label={label} className={styles.iconLabel} />
      {onRemove && (
        <button className={styles.remove} onClick={onRemove} type="button">
          <IconWrapper size={16}>
            <X size={12} weight="bold" />
          </IconWrapper>
        </button>
      )}
    </span>
  );
}
