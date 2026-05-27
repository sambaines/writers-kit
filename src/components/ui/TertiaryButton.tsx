import { forwardRef } from 'react';
import IconLabel from './IconLabel';
import styles from './TertiaryButton.module.css';

interface TertiaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: React.ReactNode;
}

const TertiaryButton = forwardRef<HTMLButtonElement, TertiaryButtonProps>(
  ({ label, icon, className, ...props }, ref) => (
    <button
      ref={ref}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      type="button"
      {...props}
    >
      <IconLabel icon={icon} label={label} />
    </button>
  )
);

TertiaryButton.displayName = 'TertiaryButton';

export default TertiaryButton;
