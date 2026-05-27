import styles from './HeaderRowOption.module.css';

interface HeaderRowOptionProps {
  label: string;
}

export default function HeaderRowOption({ label }: HeaderRowOptionProps) {
  return <div className={styles.root}>{label}</div>;
}
