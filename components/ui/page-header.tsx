'use client'

interface PageHeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  breadcrumb?: Array<{ label: string; href?: string }>
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <div className="mb-8 border-b border-[var(--border)] pb-6">
      {breadcrumb && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          {breadcrumb.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && <span>/</span>}
              {item.href ? (
                <a href={item.href} className="hover:text-[var(--primary)]">
                  {item.label}
                </a>
              ) : (
                <span>{item.label}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-700 text-[var(--text)] mb-2">
            {title}
          </h1>
          {description && (
            <p className="text-[var(--text-muted)]">{description}</p>
          )}
        </div>

        {action && (
          <button
            onClick={action.onClick}
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-fg)] font-medium hover:bg-[var(--primary-hover)] transition-colors whitespace-nowrap"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
