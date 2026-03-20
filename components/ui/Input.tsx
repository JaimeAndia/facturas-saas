import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  ayuda?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, ayuda, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg border px-3 text-sm',
            'bg-white text-gray-900 placeholder:text-gray-400',
            'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0',
            error
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60 dark:disabled:bg-gray-900',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {ayuda && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{ayuda}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
