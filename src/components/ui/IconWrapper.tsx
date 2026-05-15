import styles from './IconWrapper.module.css';

interface IconWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export default function IconWrapper({ children, className }: IconWrapperProps) {
  return (
    <span className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
