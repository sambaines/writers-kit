import styles from './ColorPicker.module.css';

export const PRESET_COLORS = [
  '#8A8A96', // neutral grey
  '#4A9EFF', // blue
  '#7A6DF4', // purple
  '#4ED898', // green
  '#F0A429', // amber
  '#FF5370', // red
  '#FF9057', // orange
  '#50E3A4', // mint
  '#E879A8', // pink
  '#5CC8FF', // sky
  '#A78BFA', // violet
  '#34D399', // emerald
  '#FBBF24', // yellow
  '#F87171', // rose
  '#60A5FA', // indigo-blue
  '#C084FC', // lilac
  '#2DD4BF', // teal
  '#FB923C', // peach
  '#94A3B8', // slate
  '#E2E8F0', // off-white
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className={styles.grid}>
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`${styles.swatch} ${value === color ? styles.active : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          title={color}
          aria-label={color}
        />
      ))}
    </div>
  );
}
