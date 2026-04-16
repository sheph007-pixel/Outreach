import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: string
}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant ?? 'bg-gray-100 text-gray-800',
        className
      )}
      {...props}
    />
  )
}
