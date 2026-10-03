import { ReactNode } from 'react'

interface MetaGroupProps {
  title?: string
  children: ReactNode
}

export default function MetaGroup({ title, children }: MetaGroupProps) {
  return (
    <div>
      {title && (
        <h3 className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold mb-2 px-1">
          {title}
        </h3>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}