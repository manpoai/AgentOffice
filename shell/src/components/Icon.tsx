// Stub for Outline's Icon component
import * as React from 'react';
type Props = { children?: React.ReactNode; className?: string; size?: number; color?: string; [key: string]: any };
export default function Icon({ children, className, size = 24, ...rest }: Props) {
  return <span className={className} style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} {...rest}>{children}</span>;
}
