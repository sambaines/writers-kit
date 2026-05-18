import IconLabel from './IconLabel';
import styles from './StatRow.module.css';

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

export default function StatRow({ icon, label, value }: StatRowProps) {
  return (
    <div className={styles.root}>
      <IconLabel icon={icon} label={label} />
      <span className={styles.value}>{value}</span>
    </div>
  );
}
