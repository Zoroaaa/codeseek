import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
  variant?: 'default' | 'dots' | 'pulse';
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  className,
  variant = 'default',
}) => {
  const renderSpinner = () => {
    if (variant === 'dots') {
      return (
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={clsx(
                'rounded-full bg-primary-500',
                size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3'
              )}
              style={{
                animation: 'bounce 1s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      );
    }

    if (variant === 'pulse') {
      return (
        <div className={clsx(
          'rounded-full bg-primary-500/20 animate-pulse',
          size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-12 h-12' : 'w-16 h-16'
        )}>
          <div className={clsx(
            'w-full h-full rounded-full bg-primary-500 animate-ping',
            size === 'sm' ? 'scale-50' : size === 'md' ? 'scale-50' : 'scale-50'
          )} />
        </div>
      );
    }

    return (
      <Loader2 className={clsx('animate-spin text-primary-500', sizeStyles[size])} />
    );
  };

  const content = (
    <div className={clsx('flex flex-col items-center justify-center gap-3', className)}>
      {renderSpinner()}
      {text && (
        <p className="text-sm font-medium text-surface-500 dark:text-surface-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/90 dark:bg-surface-950/90 backdrop-blur-md z-50 animate-fade-in">
        {content}
      </div>
    );
  }

  return content;
};

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'shimmer' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  width,
  height,
  animation = 'shimmer',
}) => {
  return (
    <div
      className={clsx(
        animation === 'shimmer' && 'skeleton',
        animation === 'pulse' && 'animate-pulse bg-surface-200 dark:bg-surface-700',
        animation === 'none' && 'bg-surface-200 dark:bg-surface-700',
        variant === 'text' && 'h-4 rounded-lg',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-lg',
        variant === 'rounded' && 'rounded-xl',
        className
      )}
      style={{ width, height }}
    />
  );
};

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className,
  lines = 3,
}) => {
  return (
    <div className={clsx(
      'p-5 rounded-2xl border border-surface-200/60 dark:border-surface-700/60 bg-white dark:bg-surface-800/80',
      className
    )}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={16} />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={i === lines - 1 ? '70%' : '100%'}
            height={14}
          />
        ))}
      </div>
    </div>
  );
};
