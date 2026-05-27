import { useRef } from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import styles from './Input.module.css';

interface InputProps {
  type?: 'text' | 'number' | 'email' | 'password' | 'search';
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  step?: number;
  min?: number;
  max?: number;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  className?: string;
}

const NUM_ALLOWED = new Set(['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', '-', '.']);

export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  error,
  leadingIcon,
  trailingIcon,
  step = 1,
  min,
  max,
  id,
  name,
  autoFocus,
  className,
}: InputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isNumber = type === 'number';

  function handleStep(dir: 1 | -1) {
    const current = parseFloat(inputRef.current?.value ?? '0') || 0;
    let next = current + dir * step;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    const strVal = String(next);
    // update uncontrolled input directly
    if (inputRef.current && value === undefined) {
      inputRef.current.value = strVal;
    }
    inputRef.current?.focus();
    onChange?.({ target: { value: strVal } } as React.ChangeEvent<HTMLInputElement>);
  }

  return (
    <div
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      data-error={error || undefined}
      data-disabled={disabled || undefined}
      data-has-leading={leadingIcon ? '' : undefined}
      data-has-trailing={(isNumber || trailingIcon) ? '' : undefined}
    >
      <div className={styles.innerRing} />
      <div className={styles.content}>
        {leadingIcon && <span className={styles.iconSlot}>{leadingIcon}</span>}
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          inputMode={isNumber ? 'numeric' : undefined}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          id={id}
          name={name}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (!isNumber) return;
            if (!NUM_ALLOWED.has(e.key) && !/^\d$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
            }
          }}
        />
        {!isNumber && trailingIcon && <span className={styles.iconSlot}>{trailingIcon}</span>}
        {isNumber && (
          <span className={styles.steppers}>
            <button
              className={styles.stepper}
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); handleStep(1); }}
              disabled={disabled}
            >
              <CaretUp size={8} />
            </button>
            <button
              className={styles.stepper}
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); handleStep(-1); }}
              disabled={disabled}
            >
              <CaretDown size={8} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
