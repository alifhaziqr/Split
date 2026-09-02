import { Money } from '../../components/Money.js'
import type { WireBalance, WireMember } from '../../net/types.js'

export function BalanceList(props: { readonly balances: readonly WireBalance[]; readonly members: readonly WireMember[]; readonly currency: string }) {
  function nameFor(memberId: string): string {
    return props.members.find((m) => m.id === memberId)?.name ?? memberId
  }

  return (
    <ul>
      {props.balances.map((balance) => (
        <li key={balance.memberId}>
          {balance.balanceCents > 0 && (
            <>
              {nameFor(balance.memberId)} is owed <Money cents={balance.balanceCents} currency={props.currency} />
            </>
          )}
          {balance.balanceCents < 0 && (
            <>
              {nameFor(balance.memberId)} owes <Money cents={-balance.balanceCents} currency={props.currency} />
            </>
          )}
          {balance.balanceCents === 0 && <>{nameFor(balance.memberId)} is settled up</>}
        </li>
      ))}
    </ul>
  )
}
