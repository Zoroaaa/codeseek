import React, { CSSProperties } from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

const variantStyles = {
  default: 'bg-surface-100 text-surface-700 dark:bg-surface-700/80 dark:text-surface-300',
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400',
  warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400',
  error: 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  outline: 'bg-transparent border border-surface-300 text-surface-700 dark:border-surface-600 dark:text-surface-300',
  accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400',
};

const dotColors = {
  default: 'bg-surface-500',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  info: 'bg-blue-500',
  outline: 'bg-surface-500',
  accent: 'bg-accent-500',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  icon,
  className,
  style,
}) => {
  return (
    <span
      className={clsx(
        'badge-base',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      style={style}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />
      )}
      {icon}
      {children}
    </span>
  );
};

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusConfig = {
  online: { color: 'bg-success-500', label: '在线' },
  offline: { color: 'bg-surface-400', label: '离线' },
  busy: { color: 'bg-error-500', label: '忙碌' },
  away: { color: 'bg-warning-500', label: '离开' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  className,
}) => {
  const config = statusConfig[status];
  
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span className={clsx(
        'rounded-full animate-pulse',
        size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5',
        config.color
      )} />
      <span className={clsx(
        'font-medium text-surface-600 dark:text-surface-400',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}>
        {label || config.label}
      </span>
    </span>
  );
};
