import { Check, Prohibit, Plus, X } from '@phosphor-icons/react';
import IconLabel from './IconLabel';
import IconWrapper from './IconWrapper';
import styles from './SelectOption.module.css';

export type AnimPhase = 'transitioning' | 'check-white';

interface SelectOptionProps {
  label: string;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  preText?: string;
  preTextFaded?: boolean;
  selected?: boolean;
  removable?: boolean;
  disabled?: boolean;
  iconColor?: string;
  labelColor?: string;
  // Animated trailing (Plus → Check)
  showAnimatedTrailing?: boolean;
  animPhase?: AnimPhase;
  animCheckColor?: string;
  onClick?: () => void;
}

export default function SelectOption({
  label,
  icon,
  trailingIcon,
  preText,
  preTextFaded,
  selected,
  removable = false,
  disabled,
  iconColor,
  labelColor,
  showAnimatedTrailing,
  animPhase,
  animCheckColor,
  onClick,
}: SelectOptionProps) {
  const staticTrailing = showAnimatedTrailing ? null
    : trailingIcon ? trailingIcon
    : disabled ? <Prohibit size={12} />
    : null;

  const phaseClass = animPhase === 'transitioning' ? styles.phaseTransitioning
    : animPhase === 'check-white' ? styles.phaseCheckWhite
    : '';

  return (
    <div
      className={`${styles.root}${selected ? ` ${styles.selected}` : ''}${disabled ? ` ${styles.disabled}` : ''}`}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      onClick={!disabled ? onClick : undefined}
    >
      <span className={styles.leading}>
        <IconLabel
          icon={icon}
          label={label}
          preText={preText}
          preTextFaded={preTextFaded}
          iconColor={iconColor}
          labelColor={labelColor}
        />
      </span>

      {showAnimatedTrailing ? (
        <IconWrapper size={16}>
          <span className={`${styles.animTrailing} ${phaseClass}`}>
            <span className={styles.animPlus}><Plus size={12} /></span>
            <span className={styles.animCheck} style={{ color: animCheckColor }}>
              <Check size={12} />
            </span>
          </span>
        </IconWrapper>
      ) : selected && removable ? (
        <IconWrapper size={16}>
          <span className={styles.selectedTrailing}>
            <span className={styles.selectedCheck}><Check size={12} /></span>
            <span className={styles.selectedRemove}><X size={12} /></span>
          </span>
        </IconWrapper>
      ) : selected ? (
        <IconWrapper size={16}>
          <Check size={12} />
        </IconWrapper>
      ) : staticTrailing ? (
        <IconWrapper size={16}>
          <span style={iconColor ? { color: iconColor } : undefined}>{staticTrailing}</span>
        </IconWrapper>
      ) : null}
    </div>
  );
}
