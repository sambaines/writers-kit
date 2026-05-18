import styles from './Button.module.css';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export default function Button({
  children,
  onClick,
  disabled,
  leadingIcon,
  trailingIcon,
  type = 'button',
  className,
}: ButtonProps) {
  return (
    <button
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      <div className={styles.innerRing} />
      <div className={styles.content}>
        {leadingIcon && <span className={styles.iconSlot}>{leadingIcon}</span>}
        <span className={styles.label}>{children}</span>
        {trailingIcon && <span className={styles.iconSlot}>{trailingIcon}</span>}
      </div>
    </button>
  );
}
