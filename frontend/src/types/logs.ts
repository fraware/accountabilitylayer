/** Log document returned from search API (Mongo lean). */
export interface LogDocument {
  _id: string;
  agent_id: string;
  step_id: number;
  trace_id?: string;
  user_id?: string;
  timestamp: string;
  reasoning?: string;
  status?: string;
  reviewed?: boolean;
  review_comments?: string;
  input_data?: unknown;
  output?: unknown;
  metadata?: unknown;
}

export interface LogSearchPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface LogSearchResponse {
  data: LogDocument[];
  pagination: LogSearchPagination;
}

/** Filter shape from LogFilter / URL query builder. */
export interface LogSearchFilters {
  agent?: string;
  traceId?: string;
  status?: string;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
  reviewed?: string;
}
