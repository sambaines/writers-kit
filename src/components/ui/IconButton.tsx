import styles from './IconButton.module.css';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
}

export default function IconButton({ icon, onClick, label, className }: IconButtonProps) {
  return (
    <button
      className={`${styles.btn}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
