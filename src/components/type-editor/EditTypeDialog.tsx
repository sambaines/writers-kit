import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import { useVaultStore } from '../../store/vault.store';
import type { SchemaDefinition } from '../../types';
import DynamicIcon from '../ui/DynamicIcon';
import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import FieldEditor from './FieldEditor';
import type { FieldDefinition } from '../../types';
import styles from './TypeDialog.module.css';

interface EditTypeDialogProps {
  schema: SchemaDefinition | null;
  onClose: () => void;
}

export default function EditTypeDialog({ schema, onClose }: EditTypeDialogProps) {
  const editSchema = useVaultStore((s) => s.editSchema);

  const [name, setName]           = useState('');
  const [icon, setIcon]           = useState('Note');
  const [color, setColor]         = useState('#4A9EFF');
  const [description, setDescription] = useState('');
  const [fields, setFields]       = useState<FieldDefinition[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Sync form state when schema prop changes
  useEffect(() => {
    if (schema) {
      setName(schema.name);
      setIcon(schema.icon);
      setColor(schema.color);
      setDescription(schema.description ?? '');
      setFields(schema.fields);
      setError(null);
    }
  }, [schema?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schema) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await editSchema({
        ...schema,
        name: trimmed,
        icon,
        color,
        description: description.trim() || undefined,
        fields,
      });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={!!schema} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={`${styles.content} ${styles.contentWide}`}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Edit Type</Dialog.Title>
            <Dialog.Close asChild>
              <button className={styles.closeBtn} aria-label="Close">
                <X size={15} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Preview */}
            <div className={styles.preview}>
              <div className={styles.previewIcon} style={{ background: `${color}20` }}>
                <DynamicIcon name={icon} size={22} weight="duotone" color={color} />
              </div>
              <span className={styles.previewName} style={{ color }}>
                {name || 'Type'}
              </span>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.col}>
                {/* Name */}
                <div className={styles.field}>
                  <label className={styles.label}>Name</label>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* Color */}
                <div className={styles.field}>
                  <label className={styles.label}>Color</label>
                  <ColorPicker value={color} onChange={setColor} />
                </div>

                {/* Icon */}
                <div className={styles.field}>
                  <label className={styles.label}>Icon</label>
                  <IconPicker value={icon} onChange={setIcon} color={color} />
                </div>

                {/* Description */}
                <div className={styles.field}>
                  <label className={styles.label}>Description <span className={styles.optional}>(optional)</span></label>
                  <textarea
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {/* Fields */}
              <div className={styles.col}>
                <div className={styles.field}>
                  <label className={styles.label}>Fields</label>
                  <FieldEditor fields={fields} onChange={setFields} />
                </div>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <Dialog.Close asChild>
                <button type="button" className={styles.cancelBtn}>Cancel</button>
              </Dialog.Close>
              <button type="submit" className={styles.submitBtn} disabled={!name.trim() || saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
