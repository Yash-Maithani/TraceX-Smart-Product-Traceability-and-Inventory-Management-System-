import type { BatchSummaryDto } from '../../api/types';
import { isOnHold } from '../../components/ui/statusMap';

/**
 * The batch to ship next for each product: the first row per SKU, in the server's queue order,
 * that is not on hold. Only grouping happens here; the order itself always comes from the server.
 */
export function nextToShipIds(queue: readonly BatchSummaryDto[]): Set<string> {
  const seenSkus = new Set<string>();
  const ids = new Set<string>();
  for (const row of queue) {
    const sku = (row.sku ?? '').toUpperCase();
    if (!row.id || seenSkus.has(sku) || isOnHold(row)) continue;
    seenSkus.add(sku);
    ids.add(row.id);
  }
  return ids;
}
