import { X, DotsSixVertical } from '@phosphor-icons/react';
import IconWrapper from './IconWrapper';
import styles from './PropertyRow.module.css';

interface PropertyRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  onDelete?: () => void;
  multiline?: boolean;
  className?: string;
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

export default function PropertyRow({ icon, label, children, onDelete, multiline, className, onDragHandlePointerDown }: PropertyRowProps) {
  return (
    <div
      className={`${styles.root}${multiline ? ` ${styles.multiline}` : ''}${className ? ` ${className}` : ''}`}
    >
      {onDragHandlePointerDown && (
        <button
          className={styles.dragHandle}
          onPointerDown={onDragHandlePointerDown}
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <IconWrapper size={24}>
            <DotsSixVertical size={16} />
          </IconWrapper>
        </button>
      )}
      <div className={styles.row}>
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
    </div>
  );
}
