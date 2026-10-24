/**
 * Copy entry point (DESIGN.md §5). Feature files are added phase by phase; `en.ts` stays as the
 * original Phase 5 catalogue until every import has moved.
 */
export { STRINGS } from './en';
export { DATE_RANGE_STRINGS, DISPLAY_STRINGS, LIVE_STRINGS, PALETTE_STRINGS, SHELL_STRINGS, TABLE_STRINGS } from './common';
export { RAIL_STRINGS, STATUS_STRINGS } from './status';
