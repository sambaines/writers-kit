import IconWrapper from './IconWrapper';
import styles from './StatRow.module.css';

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

export default function StatRow({ icon, label, value }: StatRowProps) {
  return (
    <div className={styles.root}>
      <span className={styles.iconLabel}>
        <IconWrapper>{icon}</IconWrapper>
        <span className={styles.labelText}>{label}</span>
      </span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
