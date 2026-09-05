# UI feedback

## Shared global toast

Transient success and error feedback uses the global toaster mounted by
[`src/main.tsx`](../src/main.tsx). It renders notifications in the shared
top-right location, so feature screens should not create their own transient
success card or banner.

Inside a React component, obtain the toaster with `useToaster` and call
`showToast`:

```tsx
import { useToaster } from '../ui/ToasterContext'

function RewardScreen() {
  const { showToast } = useToaster()

  function onRewardReceived(itemName: string, quantity: number) {
    showToast(`Loot received\n${itemName}\n×${quantity}`)
  }

  // ...
}
```

`showToast(message, kind)` accepts `info` (the default) or `error`. Multi-line
messages are supported and preserve line breaks in the toast.

### Loot toast conventions

- Use the first line for the event, such as `Catch received`, `Loot received`,
  or `Fish salvaged`.
- Use the second line for the item or reward name.
- Put quantity, effect, rarity, size, enchantment, or Essence details on later
  lines.
- Show the toast only after the server or service operation succeeds.
- Keep operation failures explicit and use `showToast(message, 'error')` when
  the failure is transient user-facing feedback.
- Do not duplicate the same success message in local component state.

The API is defined in
[`src/ui/ToasterContext.ts`](../src/ui/ToasterContext.ts), and the provider is
mounted in [`src/main.tsx`](../src/main.tsx).
