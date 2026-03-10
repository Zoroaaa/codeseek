import React, { CSSProperties } from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'accent';
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

const variantStyles = {
  default: 'bg-surface-100 text-surface-700 dark:bg-surface-700 dark:text-surface-300',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  error: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
  info: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  outline: 'bg-transparent border border-surface-300 text-surface-700 dark:border-surface-600 dark:text-surface-300',
  accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
  style,
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
};
