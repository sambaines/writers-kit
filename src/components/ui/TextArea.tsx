import styles from './TextArea.module.css';

interface TextAreaProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  rows?: number;
  id?: string;
  name?: string;
  className?: string;
}

export default function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  error,
  rows = 4,
  id,
  name,
  className,
}: TextAreaProps) {
  return (
    <div
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      data-error={error || undefined}
      data-disabled={disabled || undefined}
    >
      <div className={styles.innerRing} />
      <div className={styles.content}>
        <textarea
          className={styles.textarea}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          id={id}
          name={name}
        />
      </div>
    </div>
  );
}
