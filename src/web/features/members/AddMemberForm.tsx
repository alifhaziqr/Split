import { useState } from 'react'
import type { FormEvent } from 'react'

import { ErrorBanner } from '../../components/ErrorBanner.js'
import { useAddMember } from '../../queries/members.js'

export function AddMemberForm(props: { readonly groupId: string }) {
  const addMember = useAddMember(props.groupId)
  const [name, setName] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addMember.mutate(
      { name },
      {
        // Clear only on success — a DUPLICATE_MEMBER 409 keeps the typed
        // name so the user edits "Ana" into "Ana K." rather than retyping.
        onSuccess: () => setName(''),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="add-member-name">Name</label>
      <input id="add-member-name" value={name} onChange={(e) => setName(e.target.value)} required />
      <button type="submit" disabled={addMember.isPending}>
        {addMember.isPending ? 'Adding…' : 'Add member'}
      </button>
      <ErrorBanner error={addMember.error} />
    </form>
  )
}
