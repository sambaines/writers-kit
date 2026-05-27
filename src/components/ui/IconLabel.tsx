import IconWrapper from './IconWrapper';
import styles from './IconLabel.module.css';

interface IconLabelProps {
  icon: React.ReactNode;
  label: string;
  preText?: string;
  preTextFaded?: boolean;
  iconColor?: string;
  labelColor?: string;
  className?: string;
}

export default function IconLabel({ icon, label, preText, preTextFaded, iconColor, labelColor, className }: IconLabelProps) {
  return (
    <span className={`${styles.root}${className ? ` ${className}` : ''}`}>
      <IconWrapper>
        <span style={iconColor ? { color: iconColor } : undefined}>{icon}</span>
      </IconWrapper>
      {preText && (
        <span className={`${styles.preText}${preTextFaded ? ` ${styles.preTextFaded}` : ''}`}>
          {preText}
        </span>
      )}
      <span className={styles.label} style={labelColor ? { color: labelColor } : undefined}>
        {label}
      </span>
    </span>
  );
}
