import { EmptyState } from '../../components/EmptyState.js'
import { Money } from '../../components/Money.js'
import type { WireMember, WireTransfer } from '../../net/types.js'

export function TransferList(props: { readonly transfers: readonly WireTransfer[]; readonly members: readonly WireMember[]; readonly currency: string }) {
  function nameFor(memberId: string): string {
    return props.members.find((m) => m.id === memberId)?.name ?? memberId
  }

  if (props.transfers.length === 0) {
    return <EmptyState message="Everyone is settled up" />
  }

  return (
    <ul>
      {props.transfers.map((transfer, index) => (
        // Transfers carry no id of their own from the server, and the list
        // is stable per render — the server's output isn't reordered
        // client-side — so the array index is a safe key here.
        <li key={index}>
          {nameFor(transfer.fromMemberId)} pays {nameFor(transfer.toMemberId)}{' '}
          <Money cents={transfer.amountCents} currency={props.currency} />
        </li>
      ))}
    </ul>
  )
}
