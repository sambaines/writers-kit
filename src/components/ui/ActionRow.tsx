import styles from './ActionRow.module.css';

interface ActionRowProps {
  children: React.ReactNode;
}

export default function ActionRow({ children }: ActionRowProps) {
  return <div className={styles.root}>{children}</div>;
}
