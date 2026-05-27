import styles from './TagsRow.module.css';

interface TagsRowProps {
  children: React.ReactNode;
}

export default function TagsRow({ children }: TagsRowProps) {
  return <div className={styles.root}>{children}</div>;
}
