import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'default';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white";
    
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700",
      default: "bg-blue-600 text-white hover:bg-blue-700",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
      outline: "border border-slate-200 hover:bg-slate-100 hover:text-slate-900",
      ghost: "hover:bg-slate-100 hover:text-slate-900",
    };
    
    const sizes = {
      sm: "h-9 px-3",
      md: "h-10 py-2 px-4",
      lg: "h-11 px-8",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
