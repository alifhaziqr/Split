import { cn } from '../../lib/cn.js'
import { balanceBarWidthPercent, balanceSign } from './balanceBar.js'

/**
 * A decorative proportional bar next to each BalanceList row — aria-hidden
 * because the row's own text ("Ana is owed 12.50 USD") already carries the
 * information; this is a visual aid, not a second source of truth. Width is
 * the one legitimate inline style in this codebase: a dynamic percentage
 * Tailwind can't express as a static utility class.
 */
export function BalanceBar(props: { readonly cents: number; readonly maxAbsCents: number }) {
  const sign = balanceSign(props.cents)
  const widthPercent = balanceBarWidthPercent(props.cents, props.maxAbsCents)

  return (
    <span aria-hidden="true" className="block h-1.5 w-full overflow-hidden rounded-full bg-canvas">
      <span
        className={cn('block h-full rounded-full', sign === 'positive' && 'bg-positive', sign === 'negative' && 'bg-negative')}
        style={{ width: `${widthPercent}%` }}
      />
    </span>
  )
}
