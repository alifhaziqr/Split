/** Purely presentational: the four split modes as a radiogroup. */

import type { SplitMode } from '../../../core/split.js'

const MODES: readonly SplitMode[] = ['EQUAL', 'EXACT', 'PERCENT', 'SHARES']

export function SplitModeTabs(props: { readonly mode: SplitMode; readonly onChange: (mode: SplitMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Split mode">
      {MODES.map((mode) => (
        <label key={mode}>
          <input type="radio" name="split-mode" checked={props.mode === mode} onChange={() => props.onChange(mode)} />
          {mode}
        </label>
      ))}
    </div>
  )
}
