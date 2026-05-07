import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Warning, X, CaretDown } from '@phosphor-icons/react';
import { useVaultStore } from '../../store/vault.store';
import type { SchemaDefinition } from '../../types';
import DynamicIcon from '../ui/DynamicIcon';
import styles from './DeleteTypeDialog.module.css';

interface DeleteTypeDialogProps {
  schema: SchemaDefinition | null;
  orphanCount: number;
  otherSchemas: SchemaDefinition[];
  onClose: () => void;
}

export default function DeleteTypeDialog({
  schema,
  orphanCount,
  otherSchemas,
  onClose,
}: DeleteTypeDialogProps) {
  const deleteSchema        = useVaultStore((s) => s.deleteSchema);
  const reassignEntitiesType = useVaultStore((s) => s.reassignEntitiesType);

  const [reassignTo, setReassignTo] = useState<string>('__none');
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleDelete() {
    if (!schema) return;
    setBusy(true);
    setError(null);
    try {
      if (reassignTo !== '__none' && orphanCount > 0) {
        await reassignEntitiesType(schema.name, reassignTo);
      }
      await deleteSchema(schema);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={!!schema} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Delete Type</Dialog.Title>
            <Dialog.Close asChild>
              <button className={styles.closeBtn} aria-label="Close"><X size={15} /></button>
            </Dialog.Close>
          </div>

          <div className={styles.body}>
            <div className={styles.warningRow}>
              <Warning size={18} weight="fill" color="#F0A429" />
              <p>
                Delete <strong style={{ color: schema?.color }}>{schema?.name}</strong>?
                This cannot be undone.
              </p>
            </div>

            {orphanCount > 0 ? (
              <div className={styles.orphanSection}>
                <p className={styles.orphanNote}>
                  {orphanCount} {orphanCount === 1 ? 'entity uses' : 'entities use'} this type.
                  Choose what to do with {orphanCount === 1 ? 'it' : 'them'}:
                </p>

                <Select.Root value={reassignTo} onValueChange={setReassignTo}>
                  <Select.Trigger asChild>
                    <button className={styles.selectTrigger}>
                      <span>
                        {reassignTo === '__none'
                          ? 'Leave untyped (visible in All Files)'
                          : otherSchemas.find((s) => s.name === reassignTo)?.name ?? reassignTo}
                      </span>
                      <CaretDown size={11} />
                    </button>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className={styles.selectContent} position="popper" sideOffset={4}>
                      <Select.Viewport>
                        <Select.Item value="__none" className={styles.selectItem}>
                          <Select.ItemText>Leave untyped (visible in All Files)</Select.ItemText>
                        </Select.Item>
                        {otherSchemas.length > 0 && (
                          <>
                            <div className={styles.selectSep} />
                            {otherSchemas.map((s) => (
                              <Select.Item key={s.id} value={s.name} className={styles.selectItem}>
                                <Select.ItemText>
                                  <span className={styles.selectItemInner}>
                                    <DynamicIcon name={s.icon} size={12} color={s.color} />
                                    <span>{s.name}</span>
                                  </span>
                                </Select.ItemText>
                              </Select.Item>
                            ))}
                          </>
                        )}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            ) : (
              <p className={styles.noOrphans}>No entities use this type.</p>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </div>

          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button className={styles.cancelBtn}>Cancel</button>
            </Dialog.Close>
            <button className={styles.deleteBtn} onClick={handleDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete Type'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
