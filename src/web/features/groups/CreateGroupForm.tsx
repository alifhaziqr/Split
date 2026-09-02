import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { ErrorBanner } from '../../components/ErrorBanner.js'
import { useCreateGroup } from '../../queries/groups.js'

export function CreateGroupForm() {
  const navigate = useNavigate()
  const createGroup = useCreateGroup()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createGroup.mutate(
      { name, currency },
      {
        onSuccess: (group) => {
          void navigate(`/groups/${group.id}`)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1">
          <label htmlFor="create-group-name">Name</label>
          <input id="create-group-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="w-28">
          <label htmlFor="create-group-currency">Currency</label>
          <input id="create-group-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </div>
      </div>
      <button
        type="submit"
        disabled={createGroup.isPending}
        className="border-transparent bg-accent text-accent-fg hover:opacity-90"
      >
        {createGroup.isPending ? 'Creating…' : 'Create group'}
      </button>
      <ErrorBanner error={createGroup.error} />
    </form>
  )
}
