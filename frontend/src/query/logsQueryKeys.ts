import type { LogSearchFilters } from '../types/logs';

export function logsSearchQueryKey(filters: LogSearchFilters) {
  return ['logs', 'search', filters] as const;
}
