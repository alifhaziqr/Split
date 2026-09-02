import { cn } from '../../lib/cn.js'
import { Money } from '../../components/Money.js'
import type { WireBalance, WireMember } from '../../net/types.js'
import { BalanceBar } from './BalanceBar.js'
import { maxAbsBalanceCents } from './balanceBar.js'

export function BalanceList(props: { readonly balances: readonly WireBalance[]; readonly members: readonly WireMember[]; readonly currency: string }) {
  function nameFor(memberId: string): string {
    return props.members.find((m) => m.id === memberId)?.name ?? memberId
  }

  const maxAbsCents = maxAbsBalanceCents(props.balances)

  return (
    <ul className="space-y-2">
      {props.balances.map((balance) => (
        <li key={balance.memberId} className="space-y-1">
          <div
            className={cn(
              'flex items-center justify-between gap-3 text-sm',
              balance.balanceCents > 0 && 'text-positive',
              balance.balanceCents < 0 && 'text-negative',
              balance.balanceCents === 0 && 'text-muted',
            )}
          >
            {balance.balanceCents > 0 && (
              <>
                <span>{nameFor(balance.memberId)} is owed</span> <Money cents={balance.balanceCents} currency={props.currency} />
              </>
            )}
            {balance.balanceCents < 0 && (
              <>
                <span>{nameFor(balance.memberId)} owes</span> <Money cents={-balance.balanceCents} currency={props.currency} />
              </>
            )}
            {balance.balanceCents === 0 && <span>{nameFor(balance.memberId)} is settled up</span>}
          </div>
          <BalanceBar cents={balance.balanceCents} maxAbsCents={maxAbsCents} />
        </li>
      ))}
    </ul>
  )
}
