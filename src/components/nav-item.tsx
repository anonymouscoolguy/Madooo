'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icon'
import type { IconName } from './icon-names'

/**
 * `'use client'` marks this whole module as running in the browser as well as on
 * the server. Almost everything in this app is a server component — rendered
 * once, on the server, with no JavaScript shipped — but `usePathname` is a hook,
 * and hooks need React's client runtime.
 *
 * It has to be a hook: a layout is not re-rendered on client-side navigation and
 * is never told the current URL, so there is no server-side way for the sidebar
 * to know which of its four links is the live one.
 *
 * The directive is per-file and infectious downwards, which is why this is its
 * own small file rather than part of `sidebar.tsx` — keeping it narrow keeps the
 * sidebar itself, and the Clerk user button it holds, on the server.
 */

type Props = {
  href: string
  icon: IconName
  children: React.ReactNode
}

export function NavItem({ href, icon, children }: Props) {
  const pathname = usePathname()

  // `startsWith` on purpose: /fixtures/12 is still Fixtures. The trailing slash
  // stops /fixtures matching a hypothetical /fixtures-archive.
  const active = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      // Read by screen readers as the current page, and the only part of the
      // active state that is not purely visual.
      aria-current={active ? 'page' : undefined}
      // `no-underline` because the base stylesheet gives every <a> the link
      // colour and a hover underline. That is right for prose and wrong for
      // chrome, so navigation opts out explicitly.
      className={`t-hover flex h-(--row-h) items-center gap-3 rounded-md px-3 no-underline focus-visible:focus-ring ${
        active
          ? 'bg-surface-sunken font-medium text-text'
          : 'text-muted hover:bg-surface-alt hover:text-text'
      }`}
    >
      <Icon name={icon} filled={active} />
      {children}
    </Link>
  )
}
