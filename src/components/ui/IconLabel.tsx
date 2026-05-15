import IconWrapper from './IconWrapper';
import styles from './IconLabel.module.css';

interface IconLabelProps {
  icon: React.ReactNode;
  label: string;
  className?: string;
}

export default function IconLabel({ icon, label, className }: IconLabelProps) {
  return (
    <span className={`${styles.root}${className ? ` ${className}` : ''}`}>
      <IconWrapper>{icon}</IconWrapper>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
