import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface MetaItemProps {
  icon: ReactNode
  label: string
  value: ReactNode
  onClick?: () => void
  action?: ReactNode
}

export default function MetaItem({
  icon,
  label,
  value,
  onClick,
  action,
}: MetaItemProps) {
  const isClickable = Boolean(onClick)
  const Wrapper: any = isClickable ? 'button' : 'div'

  return (
    <Wrapper
      type={isClickable ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${
        isClickable ? 'hover:bg-ink-50 group cursor-pointer' : ''
      }`}
    >
      <span className="text-ink-400 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-ink-400 font-medium">
          {label}
        </div>
        <div className="text-[12.5px] text-ink-900 font-medium truncate mt-0.5">
          {value}
        </div>
      </div>
      {action
        ? action
        : isClickable && (
            <ChevronRight
              size={13}
              className="text-ink-300 group-hover:text-ink-500 transition-colors shrink-0"
            />
          )}
    </Wrapper>
  )
}