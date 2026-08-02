import { UserButton } from '@clerk/nextjs'
import { NavItem } from './nav-item'
import type { IconName } from './icon-names'

/**
 * The four destinations, in the order the design puts them. Fixtures is the
 * app's front door; Players, Teams and Diary are placeholders until step 7.
 */
const DESTINATIONS: { href: string; icon: IconName; label: string }[] = [
  { href: '/fixtures', icon: 'view_agenda', label: 'Fixtures' },
  { href: '/players', icon: 'groups', label: 'Players' },
  { href: '/teams', icon: 'stadium', label: 'Teams' },
  { href: '/diary', icon: 'two_pager', label: 'Diary' },
]

export function Sidebar() {
  return (
    <aside className="row-span-2 flex w-(--sidebar-w) flex-col border-r border-border bg-surface">
      {/* The wordmark sits at exactly the top bar's height, so the two line up
          across the sidebar's border. */}
      <div className="flex h-(--rail-w) shrink-0 items-center px-5">
        <span className="text-title">Madooo</span>
      </div>

      {/* px-2 here plus px-3 on each item puts the icons 20px in, level with the
          wordmark above, while leaving the active row's fill inset from the
          sidebar's edge rather than running into it. */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1">
          {DESTINATIONS.map(({ href, icon, label }) => (
            <li key={href}>
              <NavItem href={href} icon={icon}>
                {label}
              </NavItem>
            </li>
          ))}
        </ul>
      </nav>

      {/*
        The signed-in identity, moved here out of the old dashboard header.

        This is Clerk's own component rather than our markup, which is a
        deliberate trade: it carries the account menu, and that menu is the only
        way to sign out. `appearance.elements` takes ordinary class names — ours
        win over Clerk's because `cssLayerName` puts Clerk in a layer below the
        utilities layer — so the name can be given the app's type even though the
        markup around it is not ours.

        Known mismatch with `foundations.md`, and left as it is on purpose: the
        avatar is the Google profile photo, or a coloured gradient when there is
        none, and the design forbids both photography and gradients.
      */}
      <div className="shrink-0 border-t border-border p-3">
        <UserButton
          showName
          appearance={{
            elements: {
              userButtonBox: 'w-full gap-3',
              userButtonTrigger: 'w-full rounded-md px-2 py-1.5 focus-visible:focus-ring',
              userButtonOuterIdentifier: 'text-body text-text',
              userButtonAvatarBox: 'size-7',
            },
          }}
        />
      </div>
    </aside>
  )
}
