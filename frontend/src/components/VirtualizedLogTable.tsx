import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  FixedSizeList as List,
  type FixedSizeList,
  type ListChildComponentProps,
} from 'react-window';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Box, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import api from '../services/api';
import { logsSearchQueryKey } from '../query/logsQueryKeys';
import type { LogDocument, LogSearchFilters, LogSearchResponse } from '../types/logs';

const LogRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isSelected' && p !== 'isHovered',
})<{ isSelected?: boolean; isHovered?: boolean }>(({ theme, isSelected, isHovered }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: isSelected
    ? theme.palette.action.selected
    : isHovered
      ? theme.palette.action.hover
      : 'transparent',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const LogCell = styled(Box, {
  shouldForwardProp: (p) => p !== 'width' && p !== 'align',
})<{ width: number; align?: 'left' | 'center' | 'right' }>(({ theme, width, align = 'left' }) => ({
  width,
  padding: theme.spacing(0, 1),
  textAlign: align,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '0.875rem',
}));

const StatusBadge = styled(Box, {
  shouldForwardProp: (p) => p !== 'status',
})<{ status?: string }>(({ theme, status }) => {
  const getStatusColor = (s: string | undefined) => {
    switch (s) {
      case 'success':
        return theme.palette.success.main;
      case 'failure':
        return theme.palette.error.main;
      case 'anomaly':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return {
    display: 'inline-block',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: getStatusColor(status),
    color: theme.palette.common.white,
    fontSize: '0.75rem',
    fontWeight: 500,
    textTransform: 'uppercase',
  };
});

export function buildLogSearchQueryString(filters: LogSearchFilters, page: number): string {
  const q: string[] = [];
  if (filters.agent) q.push(`agent_id=${encodeURIComponent(filters.agent)}`);
  if (filters.traceId) q.push(`trace_id=${encodeURIComponent(filters.traceId)}`);
  if (filters.status) q.push(`status=${encodeURIComponent(filters.status)}`);
  if (filters.keyword) q.push(`keyword=${encodeURIComponent(filters.keyword)}`);
  if (filters.fromDate) q.push(`from_date=${encodeURIComponent(filters.fromDate)}`);
  if (filters.toDate) q.push(`to_date=${encodeURIComponent(filters.toDate)}`);
  if (filters.reviewed === 'true' || filters.reviewed === 'false') {
    q.push(`reviewed=${encodeURIComponent(filters.reviewed)}`);
  }
  q.push(`page=${page}`);
  q.push('limit=100');
  return q.join('&');
}

export interface VirtualizedLogTableProps {
  filters?: LogSearchFilters;
  onLogSelect?: (log: LogDocument) => void;
  selectedLogId?: string | null;
  height?: number;
  itemHeight?: number;
}

const VirtualizedLogTable = ({
  filters = {},
  onLogSelect,
  selectedLogId = null,
  height = 600,
  itemHeight = 60,
}: VirtualizedLogTableProps) => {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const listRef = useRef<FixedSizeList>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  type ColKey = keyof Pick<
    LogDocument,
    'agent_id' | 'step_id' | 'status' | 'timestamp' | 'reasoning' | 'user_id'
  >;

  const columns: {
    key: ColKey;
    label: string;
    width: number;
    align?: 'left' | 'center' | 'right';
  }[] = useMemo(
    () => [
      { key: 'agent_id', label: 'Agent ID', width: 120 },
      { key: 'step_id', label: 'Step', width: 80, align: 'center' },
      { key: 'status', label: 'Status', width: 100, align: 'center' },
      { key: 'timestamp', label: 'Timestamp', width: 150 },
      { key: 'reasoning', label: 'Reasoning', width: 300 },
      { key: 'user_id', label: 'User', width: 120 },
    ],
    []
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } =
    useInfiniteQuery({
      queryKey: logsSearchQueryKey(filters),
      initialPageParam: 1,
      queryFn: async ({ pageParam }) => {
        const qs = buildLogSearchQueryString(filters, pageParam as number);
        const response = await api.get<LogSearchResponse>(`/logs/search?${qs}`);
        return response.data;
      },
      getNextPageParam: (lastPage) => {
        const pag = lastPage.pagination;
        if (!pag || pag.page >= pag.pages) return undefined;
        return pag.page + 1;
      },
    });

  const allLogs = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data || []);
  }, [data]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        });
      },
      { threshold: 0.1 }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const log = allLogs[index];
      if (!log) return null;

      const isSelected = selectedLogId === log._id;
      const isHovered = hoveredRow === index;

      const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString();

      const truncateText = (text: string | undefined, maxLength = 50) => {
        if (!text) return '';
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
      };

      return (
        <LogRow
          className="log-item"
          style={style}
          isSelected={isSelected}
          isHovered={isHovered}
          onClick={() => onLogSelect?.(log)}
          onMouseEnter={() => setHoveredRow(index)}
          onMouseLeave={() => setHoveredRow(null)}
        >
          {columns.map((column) => (
            <LogCell key={column.key} width={column.width} align={column.align ?? 'left'}>
              {column.key === 'status' ? (
                <StatusBadge status={log.status}>{log.status}</StatusBadge>
              ) : column.key === 'timestamp' ? (
                formatTimestamp(log.timestamp)
              ) : column.key === 'reasoning' ? (
                truncateText(log.reasoning, 40)
              ) : (
                String(log[column.key] ?? '-')
              )}
            </LogCell>
          ))}
        </LogRow>
      );
    },
    [allLogs, columns, selectedLogId, hoveredRow, onLogSelect]
  );

  useEffect(() => {
    if (selectedLogId && listRef.current) {
      const selectedIndex = allLogs.findIndex((log) => log._id === selectedLogId);
      if (selectedIndex !== -1) {
        listRef.current.scrollToItem(selectedIndex, 'center');
      }
    }
  }, [selectedLogId, allLogs]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ height }}>
        Error loading logs: {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    );
  }

  if (allLogs.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <Typography variant="body2" color="text.secondary">
          No logs found matching the current filters
        </Typography>
      </Box>
    );
  }

  const listHeight = height - 120;

  return (
    <Paper elevation={1}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h6" component="h2">
          Logs ({allLogs.length.toLocaleString()})
        </Typography>
        {hasNextPage ? (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            Scroll down to load more
          </Typography>
        ) : null}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {columns.map((column) => (
          <LogCell key={column.key} width={column.width} align={column.align ?? 'left'}>
            <Typography variant="subtitle2" fontWeight="bold">
              {column.label}
            </Typography>
          </LogCell>
        ))}
      </Box>

      <Box
        sx={{
          height: listHeight,
          width: '100%',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <List
          ref={listRef}
          height={listHeight}
          itemCount={allLogs.length}
          itemSize={itemHeight}
          itemData={allLogs}
        >
          {Row}
        </List>
      </Box>

      {isFetchingNextPage ? (
        <Box display="flex" justifyContent="center" padding={2}>
          <CircularProgress size={20} />
        </Box>
      ) : null}

      <div
        ref={(el) => {
          if (el && observerRef.current) {
            observerRef.current.observe(el);
          }
        }}
        style={{ height: '1px' }}
      />
    </Paper>
  );
};

export default VirtualizedLogTable;
