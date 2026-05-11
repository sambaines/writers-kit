import { X, Warning } from '@phosphor-icons/react';
import type { Entity } from '../../types';
import styles from '../type-editor/DeleteTypeDialog.module.css';

interface DeleteEntityDialogProps {
  entity: Entity | null;
  onConfirm: (entity: Entity) => void;
  onClose: () => void;
}

export default function DeleteEntityDialog({ entity, onConfirm, onClose }: DeleteEntityDialogProps) {
  if (!entity) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.content}>
        <div className={styles.header}>
          <p className={styles.title}>Delete "{entity.title}"?</p>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.warningRow}>
            <Warning size={16} color="var(--color-error)" weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
            <p>This will permanently delete the file and cannot be undone.</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.deleteBtn} onClick={() => { onConfirm(entity); onClose(); }}>
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
