# UI feedback

## Shared global toast

Transient success and error feedback uses the global toaster mounted by
[`src/main.tsx`](../src/main.tsx). It renders notifications in the shared
top-right location, so feature screens should not create their own transient
success card or banner.

Inside a React component, obtain the toaster with `useToaster` and call
`showLootToast` for structured reward feedback:

```tsx
import { useToaster } from '../ui/ToasterContext'

function RewardScreen() {
  const { showLootToast } = useToaster()

  function onRewardReceived(itemName: string, quantity: number) {
    showLootToast({
      title: 'Loot received',
      itemName,
      icon: <span aria-hidden="true">✦</span>,
      reward: `×${quantity}`,
    })
  }

  // ...
}
```

Use `showToast(message, kind)` for ordinary text feedback. It accepts `info`
(the default) or `error`. Use `showLootToast(options)` for rewards so the
shared presentation can retain icons, accent colors, and content hierarchy.

### Loot toast conventions

- Use `title` for the event, such as `Catch received`, `Loot received`, or
  `Fish salvaged`.
- Use `itemName` for the item or reward name.
- Use `icon` plus `accentColor` and `glowColor` when the reward has a
  species- or rarity-specific visual.
- Put quantity or Essence in `reward`, the item effect in `effect`, and rarity,
  size, or enchantment in `details`.
- Show the toast only after the server or service operation succeeds.
- Keep operation failures explicit and use `showToast(message, 'error')` when
  the failure is transient user-facing feedback.
- Do not duplicate the same success message in local component state.

The API is defined in
[`src/ui/ToasterContext.ts`](../src/ui/ToasterContext.ts), and the provider is
mounted in [`src/main.tsx`](../src/main.tsx).
