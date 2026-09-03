/**
 * A two-click destructive action, not window.confirm — the first click arms
 * it and swaps the label to "Are you sure?"; the second click, while armed,
 * calls onConfirm and disarms. Blurring away resets it too, so an armed
 * button left behind (e.g. the user clicked elsewhere) doesn't silently
 * fire on some unrelated later click.
 */

import type { ReactNode } from 'react'
import { useState } from 'react'

import { cn } from '../lib/cn.js'

export function ConfirmButton(props: {
  readonly onConfirm: () => void
  readonly disabled?: boolean | undefined
  readonly children: ReactNode
}) {
  const [armed, setArmed] = useState(false)

  return (
    <button
      type="button"
      disabled={props.disabled}
      className={cn(armed && 'border-danger bg-danger text-accent-fg hover:opacity-90')}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          return
        }
        setArmed(false)
        props.onConfirm()
      }}
    >
      {armed ? 'Are you sure?' : props.children}
    </button>
  )
}
