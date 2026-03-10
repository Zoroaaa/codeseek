import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'glass' | 'elevated';
}

const paddingStyles = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5 lg:p-6',
  lg: 'p-5 sm:p-6 lg:p-8',
};

const variantStyles = {
  default: 'bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60',
  glass: 'bg-white/60 dark:bg-surface-800/60 backdrop-blur-xl border border-white/20 dark:border-surface-700/50',
  elevated: 'bg-white dark:bg-surface-800 shadow-elevated border border-transparent',
};

export const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'md',
  hover = false,
  onClick,
  variant = 'default',
}) => {
  return (
    <div
      className={clsx(
        'rounded-2xl transition-all duration-300 ease-snappy',
        variantStyles[variant],
        paddingStyles[padding],
        hover && 'hover:shadow-elevated-lg hover:-translate-y-0.5 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: string;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
  iconColor = 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
  className,
}) => {
  return (
    <div className={clsx('flex items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            iconColor
          )}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className }) => {
  return <div className={clsx('mt-4', className)}>{children}</div>;
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => {
  return (
    <div
      className={clsx(
        'mt-4 pt-4 border-t border-surface-200/60 dark:border-surface-700/60',
        className
      )}
    >
      {children}
    </div>
  );
};

interface CardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({ 
  children, 
  columns = 3, 
  className 
}) => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={clsx('grid gap-4 sm:gap-6', gridCols[columns], className)}>
      {children}
    </div>
  );
};
