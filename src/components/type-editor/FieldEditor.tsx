import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Plus, Trash, ArrowUp, ArrowDown, CaretDown } from '@phosphor-icons/react';
import type { FieldDefinition, FieldType } from '../../types';
import styles from './FieldEditor.module.css';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text',              label: 'Text' },
  { value: 'textarea',          label: 'Long Text' },
  { value: 'number',            label: 'Number' },
  { value: 'boolean',           label: 'Boolean' },
  { value: 'date',              label: 'Date' },
  { value: 'custom-date',       label: 'Custom Date' },
  { value: 'custom-date-range', label: 'Custom Date Range' },
  { value: 'tags',              label: 'Tags' },
  { value: 'select',            label: 'Select' },
  { value: 'relation',          label: 'Relation' },
];

interface FieldEditorProps {
  fields: FieldDefinition[];
  onChange: (fields: FieldDefinition[]) => void;
}

export default function FieldEditor({ fields, onChange }: FieldEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');

  function addField() {
    const key = newKey.trim().replace(/\s+/g, '_').toLowerCase();
    const label = newLabel.trim();
    if (!key || !label) return;
    if (fields.some((f) => f.key === key)) return; // duplicate key guard
    onChange([...fields, { key, label, type: newType }]);
    setNewKey('');
    setNewLabel('');
    setNewType('text');
  }

  function removeField(key: string) {
    onChange(fields.filter((f) => f.key !== key));
  }

  function moveField(index: number, dir: -1 | 1) {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function updateField(index: number, patch: Partial<FieldDefinition>) {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <div className={styles.editor}>
      {/* Existing fields */}
      {fields.length > 0 && (
        <div className={styles.fieldList}>
          {fields.map((field, i) => (
            <div key={field.key} className={styles.fieldRow}>
              <div className={styles.fieldInputs}>
                <input
                  className={styles.input}
                  value={field.label}
                  placeholder="Label"
                  onChange={(e) => updateField(i, { label: e.target.value })}
                />
                <input
                  className={styles.input}
                  value={field.key}
                  placeholder="key"
                  onChange={(e) => updateField(i, { key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                />
                <Select.Root
                  value={field.type}
                  onValueChange={(v) => updateField(i, { type: v as FieldType })}
                >
                  <Select.Trigger asChild>
                    <button className={styles.typeSelect}>
                      <span>{FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type}</span>
                      <CaretDown size={9} />
                    </button>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className={styles.selectContent} position="popper" sideOffset={4}>
                      <Select.Viewport>
                        {FIELD_TYPES.map((t) => (
                          <Select.Item key={t.value} value={t.value} className={styles.selectItem}>
                            <Select.ItemText>{t.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              <div className={styles.fieldActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => moveField(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => moveField(i, 1)}
                  disabled={i === fields.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => removeField(field.key)}
                  aria-label="Remove field"
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new field */}
      <div className={styles.addRow}>
        <input
          className={styles.input}
          placeholder="Label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addField()}
        />
        <input
          className={styles.input}
          placeholder="key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.replace(/\s+/g, '_').toLowerCase())}
          onKeyDown={(e) => e.key === 'Enter' && addField()}
        />
        <Select.Root value={newType} onValueChange={(v) => setNewType(v as FieldType)}>
          <Select.Trigger asChild>
            <button className={styles.typeSelect}>
              <span>{FIELD_TYPES.find((t) => t.value === newType)?.label}</span>
              <CaretDown size={9} />
            </button>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className={styles.selectContent} position="popper" sideOffset={4}>
              <Select.Viewport>
                {FIELD_TYPES.map((t) => (
                  <Select.Item key={t.value} value={t.value} className={styles.selectItem}>
                    <Select.ItemText>{t.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <button
          type="button"
          className={styles.addBtn}
          onClick={addField}
          disabled={!newKey.trim() || !newLabel.trim()}
        >
          <Plus size={13} />
          Add
        </button>
      </div>
    </div>
  );
}
