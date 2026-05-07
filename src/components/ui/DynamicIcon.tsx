import type { ElementType } from 'react';
import * as Icons from '@phosphor-icons/react';

interface DynamicIconProps {
  name: string;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
  className?: string;
}

export default function DynamicIcon({
  name,
  size = 16,
  weight = 'regular',
  color,
  className,
}: DynamicIconProps) {
  const Icon = (Icons as unknown as Record<string, ElementType>)[name];
  if (!Icon) {
    return <Icons.Question size={size} weight={weight} color={color} className={className} />;
  }
  return <Icon size={size} weight={weight} color={color} className={className} />;
}
