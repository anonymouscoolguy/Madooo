import type { IconName } from './icon-names'

/** The sizes `foundations.md` allows, by the role each one is for. */
const SIZES = {
  /** 14px — badges and micro-labels. */
  xs: 'icon-xs',
  /** 16px — chips. */
  sm: 'icon-sm',
  /** 18px — buttons and fields. */
  md: 'icon-md',
  /** 20px — the default. */
  base: '',
  /** 22px — large icon buttons. */
  lg: 'icon-lg',
} as const

type Props = {
  name: IconName
  /** `FILL 1`, which means "on" — an applied verdict, the active nav item. Nothing else fills. */
  filled?: boolean
  size?: keyof typeof SIZES
  className?: string
}

/**
 * A Material Symbol.
 *
 * The glyph is selected by writing its *name as text* — the font maps the
 * ligature "trending_up" to the icon. That is why the name goes in the element's
 * body rather than in an attribute, and why the font has to load before anything
 * legible appears.
 *
 * Always `aria-hidden`: every icon in this design sits beside a label that
 * already says the same thing, so announcing it would just repeat. An icon that
 * ever stands alone needs a label on the control around it, not here.
 *
 * Colour is never set here. Icons inherit `currentColor`, so they take the
 * colour of whatever holds them — which is what keeps a chip's icon and its text
 * from ever drifting apart.
 */
export function Icon({ name, filled = false, size = 'base', className }: Props) {
  const classes = ['icon', SIZES[size], filled && 'icon-filled', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span aria-hidden className={classes}>
      {name}
    </span>
  )
}
