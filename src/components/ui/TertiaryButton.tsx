import IconLabel from './IconLabel';
import styles from './TertiaryButton.module.css';

interface TertiaryButtonProps {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function TertiaryButton({ label, icon, onClick, className }: TertiaryButtonProps) {
  return (
    <button
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      type="button"
      onClick={onClick}
    >
      <IconLabel icon={icon} label={label} />
    </button>
  );
}
