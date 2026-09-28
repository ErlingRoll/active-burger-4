/*
 * The quartermaster is gone.
 *
 * The consignment shop shipped as stage one of the market so that material
 * prices would exist before material production did. The Camp has since given
 * timber and stone their own sources and sinks, and the shelf was not worth a
 * door on the refuge, so the screen and its service are removed from the
 * client in the same change.
 *
 * The two contracts that asked for a sale are retired rather than deleted:
 * `contract_definitions` rows are referenced by claims already recorded, and
 * `get_contract_state` deals only from active rows. The `sell` and `buy`
 * operation types stay in `inventory_operations` for the rows already written,
 * and the `sell-items` branch of `contract_progress` stays for the same reason.
 *
 * The shop's tables and functions had no readers outside the shop screen, so
 * they go.
 */

update public.contract_definitions set active = false where id = 'daily-sell';
update public.contract_definitions set active = false where id = 'daily-sell-2';

drop function public.buy_from_shop(text, text, integer);
drop function public.sell_to_shop(text, uuid, integer);
drop function public.get_shop_stock();

drop table public.shop_daily_stock;
drop table public.shop_price_bands;
