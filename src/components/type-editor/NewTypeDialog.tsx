import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import { useVaultStore } from '../../store/vault.store';
import type { FieldDefinition } from '../../types';
import DynamicIcon from '../ui/DynamicIcon';
import IconPicker from './IconPicker';
import ColorPicker, { PRESET_COLORS } from './ColorPicker';
import FieldEditor from './FieldEditor';
import styles from './TypeDialog.module.css';

interface NewTypeDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NewTypeDialog({ open, onClose }: NewTypeDialogProps) {
  const createSchema = useVaultStore((s) => s.createSchema);

  const [name, setName]           = useState('');
  const [icon, setIcon]           = useState('Note');
  const [color, setColor]         = useState(PRESET_COLORS[1]); // blue default
  const [description, setDescription] = useState('');
  const [fields, setFields]       = useState<FieldDefinition[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  function reset() {
    setName('');
    setIcon('Note');
    setColor(PRESET_COLORS[1]);
    setDescription('');
    setFields([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await createSchema({ name: trimmed, icon, color, description: description.trim() || undefined, fields });
      reset();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={`${styles.content} ${styles.contentWide}`}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>New Type</Dialog.Title>
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
                <DynamicIcon name={icon} size={22} color={color} />
              </div>
              <span className={styles.previewName} style={{ color }}>
                {name || 'New Type'}
              </span>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.col}>
                {/* Name */}
                <div className={styles.field}>
                  <label className={styles.label}>Name</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Scene, Item, Faction…"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
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
                    placeholder="What is this type used for?"
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
                {saving ? 'Creating…' : 'Create Type'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
