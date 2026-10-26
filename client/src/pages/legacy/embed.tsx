import type { ReactNode } from 'react'

/**
 * Legacy pages render standalone (own `.page-content` and `h1`) or embedded in a hub tab
 * (Community, Admin), where the hub owns the only `h1` and the page title.
 */
export function PageFrame({ embedded, className, children }: { embedded?: boolean; className?: string; children: ReactNode }) {
  const base = embedded ? 'hub-panel' : 'page-content'
  return <div className={className ? `${base} ${className}` : base}>{children}</div>
}

/** Standalone: the page header with an `h1`. Embedded: a section heading with an `h2`. */
export function PageHeading({ embedded, title, description, action }: { embedded?: boolean; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  if (embedded) return <div className="section-heading hub-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
  return <header className="page-header"><div><h1>{title}</h1>{description && <p className="page-desc">{description}</p>}</div>{action}</header>
}
