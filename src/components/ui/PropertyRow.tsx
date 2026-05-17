import { X } from '@phosphor-icons/react';
import IconWrapper from './IconWrapper';
import styles from './PropertyRow.module.css';

interface PropertyRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  onDelete?: () => void;
  multiline?: boolean;
  className?: string;
}

export default function PropertyRow({ icon, label, children, onDelete, multiline, className }: PropertyRowProps) {
  return (
    <div
      className={`${styles.root}${multiline ? ` ${styles.multiline}` : ''}${className ? ` ${className}` : ''}`}
    >
      <span className={styles.label}>
        <IconWrapper>{icon}</IconWrapper>
        <span className={styles.labelText}>{label}</span>
      </span>
      <div className={styles.field}>
        {children}
      </div>
      <button
        className={`${styles.deleteBtn}${!onDelete ? ` ${styles.deleteBtnHidden}` : ''}`}
        onClick={onDelete}
        aria-label="Delete property"
        tabIndex={onDelete ? 0 : -1}
      >
        <X size={12} />
      </button>
    </div>
  );
}
