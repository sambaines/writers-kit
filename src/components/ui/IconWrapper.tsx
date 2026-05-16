import styles from './IconWrapper.module.css';

interface IconWrapperProps {
  children: React.ReactNode;
  size?: 16 | 24;
  className?: string;
}

export default function IconWrapper({ children, size = 16, className }: IconWrapperProps) {
  const sizeClass = size === 24 ? styles.wrapper24 : styles.wrapper;
  return (
    <span className={`${sizeClass}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
