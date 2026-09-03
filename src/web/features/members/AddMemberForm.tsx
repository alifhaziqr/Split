import type { FormEvent } from 'react'
import { useState } from 'react'

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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1">
        <label htmlFor="add-member-name">Name</label>
        <input
          id="add-member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <button
        type="submit"
        disabled={addMember.isPending}
        className="border-transparent bg-accent text-accent-fg hover:opacity-90"
      >
        {addMember.isPending ? 'Adding…' : 'Add member'}
      </button>
      <ErrorBanner error={addMember.error} />
    </form>
  )
}
