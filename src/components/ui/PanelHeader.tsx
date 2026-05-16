import { X } from '@phosphor-icons/react';
import IconWrapper from './IconWrapper';
import IconButton from './IconButton';
import styles from './PanelHeader.module.css';

interface PanelHeaderProps {
  title: string;
  leadingIcon?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export default function PanelHeader({ title, leadingIcon, actions, onClose, className }: PanelHeaderProps) {
  return (
    <header className={`${styles.root}${className ? ` ${className}` : ''}`}>
      {leadingIcon && (
        <IconWrapper size={24}>{leadingIcon}</IconWrapper>
      )}
      <span className={styles.title}>{title}</span>
      {(actions || onClose) && (
        <div className={styles.actions}>
          {actions}
          {onClose && (
            <IconButton icon={<X size={16} />} onClick={onClose} label="Close" />
          )}
        </div>
      )}
    </header>
  );
}
