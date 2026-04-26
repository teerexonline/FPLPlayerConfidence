import type { z } from 'zod';
import type {
  BootstrapStaticSchema,
  ElementSchema,
  ElementSummarySchema,
  EntryInfoSchema,
  EntryPickSchema,
  EntryPicksSchema,
  EventSchema,
  FixtureSchema,
  FixturesSchema,
  HistoryItemSchema,
  TeamSchema,
} from './schemas';

export type Team = z.infer<typeof TeamSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type Event = z.infer<typeof EventSchema>;
export type BootstrapStatic = z.infer<typeof BootstrapStaticSchema>;
export type HistoryItem = z.infer<typeof HistoryItemSchema>;
export type ElementSummary = z.infer<typeof ElementSummarySchema>;
export type Fixture = z.infer<typeof FixtureSchema>;
export type Fixtures = z.infer<typeof FixturesSchema>;
export type EntryPick = z.infer<typeof EntryPickSchema>;
export type EntryPicks = z.infer<typeof EntryPicksSchema>;
export type EntryInfo = z.infer<typeof EntryInfoSchema>;

export type FetchError =
  | { readonly type: 'network_error'; readonly message: string }
  | { readonly type: 'invalid_response'; readonly message: string }
  | { readonly type: 'not_found' }
  | { readonly type: 'http_error'; readonly status: number; readonly message: string };
