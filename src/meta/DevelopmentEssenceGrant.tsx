import { useState } from 'react'
import { useToaster } from '../ui/ToasterContext'
import type { MetaProgressionService } from './MetaProgressionService'

interface DevelopmentEssenceGrantProps {
  metaService: MetaProgressionService | null
  onGranted: () => void
}

const QUICK_AMOUNTS = [100, 1000, 10000] as const

/**
 * The Essence section of the header's development tools.
 *
 * Rendered only for an administrator on a build with the tools on; the
 * server refuses the grant without the admin role anyway. A machine that
 * takes Essence is hard to test on an account that has none.
 */
export function DevelopmentEssenceGrant({ metaService, onGranted }: DevelopmentEssenceGrantProps) {
  const { showToast } = useToaster()
  const [amount, setAmount] = useState('500')
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grant = async (value: number): Promise<void> => {
    if (!metaService || granting) {
      return
    }
    setGranting(true)
    setError(null)
    try {
      const balance = await metaService.grantDevelopmentEssence(value)
      showToast(`Granted ${value.toLocaleString()} Essence. Balance ${balance.toLocaleString()}.`)
      onGranted()
    } catch (grantError: unknown) {
      const message = grantError instanceof Error ? grantError.message : 'Unable to grant Essence.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setGranting(false)
    }
  }

  const grantTyped = (): void => {
    const parsed = Number(amount)
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      setError('Enter a positive whole-number amount.')
      return
    }
    void grant(parsed)
  }

  const busy = granting || metaService === null

  return (
    <div className="development-inventory-grants">
      <div className="development-inventory-quick" role="group" aria-label="Quick Essence grants">
        {QUICK_AMOUNTS.map((quick) => (
          <button
            className="development-inventory-quick-grant"
            type="button"
            key={quick}
            onClick={() => { void grant(quick) }}
            disabled={busy}
          >
            +{quick.toLocaleString()} Essence
          </button>
        ))}
      </div>
      <label>
        Amount
        <input
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(event) => { setAmount(event.target.value) }}
          disabled={granting}
        />
      </label>
      <button className="development-inventory-grant" type="button" onClick={grantTyped} disabled={busy}>
        {granting ? 'Granting…' : 'Grant Essence'}
      </button>
      {error ? <p className="development-inventory-error" role="alert">{error}</p> : null}
    </div>
  )
}
