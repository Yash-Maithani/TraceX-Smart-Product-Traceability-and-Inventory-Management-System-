import { describe, expect, it } from 'vitest';
import { nextToShipIds } from './queueModel';

describe('nextToShipIds (redesign R5)', () => {
  it('marks the first batch per product in server order and skips batches on hold', () => {
    const ids = nextToShipIds([
      { id: 'a1', sku: 'AAA' },
      { id: 'b1', sku: 'BBB', qualityCheck: { status: 'FAILED' } },
      { id: 'a2', sku: 'aaa' },
      { id: 'b2', sku: 'BBB', qualityCheck: { status: 'FLAGGED' } },
      { id: 'b3', sku: 'BBB' }
    ]);
    expect([...ids]).toEqual(['a1', 'b2']);
  });

  it('returns nothing for an empty queue or rows without ids', () => {
    expect(nextToShipIds([]).size).toBe(0);
    expect(nextToShipIds([{ sku: 'AAA' }]).size).toBe(0);
  });
});
