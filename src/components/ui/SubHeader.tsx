import { CaretRight } from '@phosphor-icons/react';
import IconWrapper from './IconWrapper';
import styles from './SubHeader.module.css';

interface SubHeaderProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  className?: string;
}

export default function SubHeader({ title, open, onToggle, action, className }: SubHeaderProps) {
  return (
    <button
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      onClick={onToggle}
      aria-expanded={open}
    >
      <IconWrapper className={open ? styles.caretOpen : styles.caret}>
        <CaretRight size={12} />
      </IconWrapper>
      <span className={styles.title}>{title}</span>
      {action && (
        <span className={styles.action} onClick={(e) => e.stopPropagation()}>
          <IconWrapper>{action}</IconWrapper>
        </span>
      )}
    </button>
  );
}
