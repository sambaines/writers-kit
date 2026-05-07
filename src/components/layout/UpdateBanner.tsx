import { useEffect } from 'react';
import { ArrowCircleUp, X, Spinner } from '@phosphor-icons/react';
import { useUpdateStore } from '../../store/update.store';
import { useShallow } from 'zustand/react/shallow';
import styles from './UpdateBanner.module.css';

export default function UpdateBanner() {
  const { update, isInstalling, installProgress, checkForUpdate, installUpdate, dismiss } =
    useUpdateStore(
      useShallow((s) => ({
        update:          s.update,
        isInstalling:    s.isInstalling,
        installProgress: s.installProgress,
        checkForUpdate:  s.checkForUpdate,
        installUpdate:   s.installUpdate,
        dismiss:         s.dismiss,
      })),
    );

  // Check for updates once on mount
  useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  if (!update) return null;

  return (
    <div className={styles.banner}>
      <ArrowCircleUp size={14} weight="fill" className={styles.icon} />
      <span className={styles.text}>
        Writers Kit <strong>{update.version}</strong> is available
        {update.body ? ` — ${update.body}` : ''}
      </span>
      {isInstalling ? (
        <span className={styles.progress}>
          <Spinner size={13} className={styles.spinner} />
          {installProgress !== null ? `${installProgress}%` : 'Installing…'}
        </span>
      ) : (
        <button className={styles.installBtn} onClick={() => void installUpdate()}>
          Install & restart
        </button>
      )}
      {!isInstalling && (
        <button className={styles.dismissBtn} onClick={dismiss} aria-label="Dismiss">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
