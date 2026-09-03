import { ConfirmButton } from '../../components/ConfirmButton.js'
import { EmptyState } from '../../components/EmptyState.js'
import { ErrorBanner } from '../../components/ErrorBanner.js'
import type { WireExpense, WireMember } from '../../net/types.js'
import { useDeleteMember } from '../../queries/members.js'
import { countReferencingExpenses, isMemberReferenced } from './memberUsage.js'

/**
 * Each row calls useDeleteMember itself, giving it its own independent
 * mutation instance — deliberately NOT one shared mutation hoisted into
 * MemberList and reused across rows keyed by memberId. A shared instance's
 * isPending/error are global to the whole list, so two different rows'
 * Remove buttons confirmed in quick succession (before a re-render commits
 * the first one's isPending) could both fire, and a later row's error could
 * get attributed to an earlier one. Per-row hooks make that race structurally
 * impossible instead of tracked around.
 */
function MemberRow(props: {
  readonly groupId: string
  readonly member: WireMember
  readonly expenses: readonly WireExpense[]
}) {
  const deleteMember = useDeleteMember(props.groupId)
  // Predicts the server's MEMBER_REFERENCED 409 from data already in hand,
  // so the user never fires a delete that can't succeed — see CLAUDE.md's
  // M5 error-UX note. A 409 from a stale-cache race (this said unreferenced,
  // the server disagrees) still renders below.
  const referenced = isMemberReferenced(props.member.id, props.expenses)
  const referencingCount = countReferencingExpenses(props.member.id, props.expenses)

  return (
    <li className="space-y-1 rounded-lg border border-subtle bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-fg">{props.member.name}</span>
        <ConfirmButton
          onConfirm={() => deleteMember.mutate(props.member.id)}
          disabled={referenced || deleteMember.isPending}
        >
          Remove
        </ConfirmButton>
      </div>
      {referenced && (
        <p className="text-sm text-muted">
          {props.member.name} is on {referencingCount} expense
          {referencingCount === 1 ? '' : 's'}. Remove those first.
        </p>
      )}
      {deleteMember.isError && <ErrorBanner error={deleteMember.error} />}
    </li>
  )
}

export function MemberList(props: {
  readonly groupId: string
  readonly members: readonly WireMember[]
  readonly expenses: readonly WireExpense[]
}) {
  if (props.members.length === 0) {
    return <EmptyState message="No members yet" />
  }

  return (
    <ul className="space-y-2">
      {props.members.map((member) => (
        <MemberRow
          key={member.id}
          groupId={props.groupId}
          member={member}
          expenses={props.expenses}
        />
      ))}
    </ul>
  )
}
