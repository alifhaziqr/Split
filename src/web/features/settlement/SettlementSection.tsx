import { ErrorBanner } from '../../components/ErrorBanner.js'
import { Spinner } from '../../components/Spinner.js'
import { useSettlementQuery } from '../../queries/settlement.js'
import type { WireMember } from '../../net/types.js'
import { BalanceList } from './BalanceList.js'
import { TransferList } from './TransferList.js'

/**
 * Self-fetching — takes only groupId and members, and fetches its own
 * settlement query rather than receiving it as a prop. That's what keeps
 * this section a section of the group detail page rather than a route: no
 * waterfall (it fires alongside the group query on mount), and promoting it
 * to a route later is a small App.tsx change, not a rewrite here.
 */
export function SettlementSection(props: { readonly groupId: string; readonly members: readonly WireMember[]; readonly currency: string }) {
  const settlement = useSettlementQuery(props.groupId)

  if (settlement.isPending) {
    return <Spinner label="Loading settlement…" />
  }
  if (settlement.isError) {
    return <ErrorBanner error={settlement.error} />
  }

  return (
    <section>
      <h2>Settle up</h2>
      <BalanceList balances={settlement.data.balances} members={props.members} currency={props.currency} />
      <TransferList transfers={settlement.data.transfers} members={props.members} currency={props.currency} />
    </section>
  )
}
