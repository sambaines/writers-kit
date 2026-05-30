import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { X, Plus, Trash, CaretDown } from '@phosphor-icons/react';
import { useVaultStore } from '../../store/vault.store';
import { useVaultData } from '../../store/vault.store';
import type { SchemaDefinition, FieldDefinition, PresetRelation, RelationKind } from '../../types';
import DynamicIcon from '../ui/DynamicIcon';
import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import FieldEditor from './FieldEditor';
import styles from './TypeDialog.module.css';

const RELATION_KINDS: { value: RelationKind; label: string }[] = [
  { value: 'parentOf',  label: 'Parent of' },
  { value: 'childOf',   label: 'Child of' },
  { value: 'siblingOf', label: 'Sibling of' },
  { value: 'relatedTo', label: 'Related to' },
];

interface PresetRelationEditorProps {
  presetRelations: PresetRelation[];
  onChange: (relations: PresetRelation[]) => void;
  currentSchemaName: string;
}

function PresetRelationEditor({ presetRelations, onChange, currentSchemaName }: PresetRelationEditorProps) {
  const { schemas } = useVaultData();
  const [newLabel, setNewLabel]         = useState('');
  const [newKind, setNewKind]           = useState<RelationKind>('childOf');
  const [newTargetType, setNewTargetType] = useState('');

  const otherSchemas = schemas.filter((s) => s.name !== currentSchemaName);

  function addPreset() {
    const label = newLabel.trim();
    if (!label || !newTargetType) return;
    onChange([...presetRelations, { label, kind: newKind, targetType: newTargetType }]);
    setNewLabel('');
    setNewKind('childOf');
    setNewTargetType('');
  }

  function removePreset(index: number) {
    onChange(presetRelations.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.presetRelEditor}>
      {presetRelations.length > 0 && (
        <div className={styles.presetRelList}>
          {presetRelations.map((pr, i) => (
            <div key={i} className={styles.presetRelRow}>
              <span className={styles.presetRelLabel}>{pr.label}</span>
              <span className={styles.presetRelKind}>{RELATION_KINDS.find((k) => k.value === pr.kind)?.label}</span>
              <span className={styles.presetRelTarget}>→ {pr.targetType}</span>
              <button
                type="button"
                className={styles.presetRelRemove}
                onClick={() => removePreset(i)}
                aria-label="Remove"
              >
                <Trash size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.presetRelAdd}>
        <input
          className={styles.input}
          placeholder="Label (e.g. Book)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPreset()}
        />
        <Select.Root value={newKind} onValueChange={(v) => setNewKind(v as RelationKind)}>
          <Select.Trigger asChild>
            <button type="button" className={styles.typeSelect}>
              <span>{RELATION_KINDS.find((k) => k.value === newKind)?.label}</span>
              <CaretDown size={9} />
            </button>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className={styles.selectContent} position="popper" sideOffset={4}>
              <Select.Viewport>
                {RELATION_KINDS.map((k) => (
                  <Select.Item key={k.value} value={k.value} className={styles.selectItem}>
                    <Select.ItemText>{k.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <Select.Root value={newTargetType} onValueChange={setNewTargetType}>
          <Select.Trigger asChild>
            <button type="button" className={styles.typeSelect}>
              <span>{newTargetType || 'Target type…'}</span>
              <CaretDown size={9} />
            </button>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className={styles.selectContent} position="popper" sideOffset={4}>
              <Select.Viewport>
                {otherSchemas.map((s) => (
                  <Select.Item key={s.name} value={s.name} className={styles.selectItem}>
                    <Select.ItemText>{s.name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <button
          type="button"
          className={styles.addBtn}
          onClick={addPreset}
          disabled={!newLabel.trim() || !newTargetType}
        >
          <Plus size={13} />
          Add
        </button>
      </div>
    </div>
  );
}

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
  const [presetRelations, setPresetRelations] = useState<PresetRelation[]>([]);
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
      setPresetRelations(schema.presetRelations ?? []);
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
        presetRelations,
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
                <DynamicIcon name={icon} size={22} color={color} />
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

              {/* Fields + Preset Relations */}
              <div className={styles.col}>
                <div className={styles.field}>
                  <label className={styles.label}>Fields</label>
                  <FieldEditor fields={fields} onChange={setFields} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Preset Relations</label>
                  <PresetRelationEditor
                    presetRelations={presetRelations}
                    onChange={setPresetRelations}
                    currentSchemaName={name}
                  />
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
