import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-primary-500 to-primary-600 
    text-white shadow-md shadow-primary-500/25 
    hover:from-primary-600 hover:to-primary-700 hover:shadow-lg hover:shadow-primary-500/30 
    focus:ring-primary-500 
    dark:from-primary-500 dark:to-primary-600 
    dark:hover:from-primary-400 dark:hover:to-primary-500
  `,
  secondary: `
    bg-surface-100 text-surface-900 
    hover:bg-surface-200 
    focus:ring-surface-400 
    dark:bg-surface-700 dark:text-surface-100 
    dark:hover:bg-surface-600
  `,
  outline: `
    border-2 border-surface-300 text-surface-700 
    hover:bg-surface-50 hover:border-surface-400 
    focus:ring-surface-400 
    dark:border-surface-600 dark:text-surface-300 
    dark:hover:bg-surface-800 dark:hover:border-surface-500
  `,
  ghost: `
    text-surface-600 
    hover:bg-surface-100 
    focus:ring-surface-400 
    dark:text-surface-400 
    dark:hover:bg-surface-800
  `,
  danger: `
    bg-gradient-to-r from-error-500 to-error-600 
    text-white shadow-md shadow-error-500/25 
    hover:from-error-600 hover:to-error-700 hover:shadow-lg hover:shadow-error-500/30 
    focus:ring-error-500 
    dark:from-error-500 dark:to-error-600 
    dark:hover:from-error-400 dark:hover:to-error-500
  `,
  success: `
    bg-gradient-to-r from-success-500 to-success-600 
    text-white shadow-md shadow-success-500/25 
    hover:from-success-600 hover:to-success-700 hover:shadow-lg hover:shadow-success-500/30 
    focus:ring-success-500 
    dark:from-success-500 dark:to-success-600 
    dark:hover:from-success-400 dark:hover:to-success-500
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-sm rounded-lg gap-1.5',
  md: 'px-4.5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  disabled,
  children,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'btn-base',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
