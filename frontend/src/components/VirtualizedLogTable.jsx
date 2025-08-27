import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useQuery, useInfiniteQuery } from 'react-query';
import { Box, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';

const VirtualizedContainer = styled(Box)(({ theme }) => ({
  height: '600px',
  width: '100%',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden'
}));

const LogRow = styled(Box)(({ theme, isSelected, isHovered }) => ({
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
    backgroundColor: theme.palette.action.hover
  }
}));

const LogCell = styled(Box)(({ theme, width, align = 'left' }) => ({
  width,
  padding: theme.spacing(0, 1),
  textAlign: align,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '0.875rem'
}));

const StatusBadge = styled(Box)(({ theme, status }) => {
  const getStatusColor = (status) => {
    switch (status) {
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
    textTransform: 'uppercase'
  };
});

const VirtualizedLogTable = ({ 
  filters = {}, 
  onLogSelect, 
  selectedLogId = null,
  height = 600,
  itemHeight = 60 
}) => {
  const [hoveredRow, setHoveredRow] = useState(null);
  const listRef = useRef();
  const observerRef = useRef();

  // Column configuration
  const columns = useMemo(() => [
    { key: 'agent_id', label: 'Agent ID', width: 120 },
    { key: 'step_id', label: 'Step', width: 80, align: 'center' },
    { key: 'status', label: 'Status', width: 100, align: 'center' },
    { key: 'timestamp', label: 'Timestamp', width: 150 },
    { key: 'reasoning', label: 'Reasoning', width: 300 },
    { key: 'user_id', label: 'User', width: 120 }
  ], []);

  // Fetch logs with infinite query for better performance
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery(
    ['logs', filters],
    async ({ pageParam = 0 }) => {
      const response = await fetch(`/api/v1/logs/search?${new URLSearchParams({
        ...filters,
        page: pageParam,
        limit: 100
      })}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      
      return response.json();
    },
    {
      getNextPageParam: (lastPage, pages) => {
        return lastPage.hasMore ? pages.length : undefined;
      },
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false
    }
  );

  // Flatten all pages into a single array
  const allLogs = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.logs || []);
  }, [data]);

  // Intersection observer for infinite scrolling
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
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Row renderer for virtualization
  const Row = useCallback(({ index, style }) => {
    const log = allLogs[index];
    if (!log) return null;

    const isSelected = selectedLogId === log._id;
    const isHovered = hoveredRow === index;

    const formatTimestamp = (timestamp) => {
      return new Date(timestamp).toLocaleString();
    };

    const truncateText = (text, maxLength = 50) => {
      if (!text) return '';
      return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    return (
      <LogRow
        style={style}
        isSelected={isSelected}
        isHovered={isHovered}
        onClick={() => onLogSelect?.(log)}
        onMouseEnter={() => setHoveredRow(index)}
        onMouseLeave={() => setHoveredRow(null)}
      >
        {columns.map((column) => (
          <LogCell key={column.key} width={column.width} align={column.align}>
            {column.key === 'status' ? (
              <StatusBadge status={log[column.key]}>
                {log[column.key]}
              </StatusBadge>
            ) : column.key === 'timestamp' ? (
              formatTimestamp(log[column.key])
            ) : column.key === 'reasoning' ? (
              truncateText(log[column.key], 40)
            ) : (
              log[column.key] || '-'
            )}
          </LogCell>
        ))}
      </LogRow>
    );
  }, [allLogs, columns, selectedLogId, hoveredRow, onLogSelect]);

  // Scroll to selected log
  useEffect(() => {
    if (selectedLogId && listRef.current) {
      const selectedIndex = allLogs.findIndex(log => log._id === selectedLogId);
      if (selectedIndex !== -1) {
        listRef.current.scrollToItem(selectedIndex, 'center');
      }
    }
  }, [selectedLogId, allLogs]);

  // Loading state
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ height }}>
        Error loading logs: {error.message}
      </Alert>
    );
  }

  // Empty state
  if (allLogs.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height}>
        <Typography variant="body2" color="text.secondary">
          No logs found matching the current filters
        </Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={1}>
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        padding={2}
        borderBottom="1px solid"
        borderColor="divider"
        backgroundColor="background.paper"
      >
        <Typography variant="h6" component="h2">
          Logs ({allLogs.length.toLocaleString()})
        </Typography>
        {hasNextPage && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            Scroll down to load more
          </Typography>
        )}
      </Box>

      {/* Column Headers */}
      <Box
        display="flex"
        alignItems="center"
        padding={1}
        backgroundColor="background.default"
        borderBottom="1px solid"
        borderColor="divider"
      >
        {columns.map((column) => (
          <LogCell key={column.key} width={column.width} align={column.align}>
            <Typography variant="subtitle2" fontWeight="bold">
              {column.label}
            </Typography>
          </LogCell>
        ))}
      </Box>

      {/* Virtualized List */}
      <VirtualizedContainer height={height - 120}>
        <List
          ref={listRef}
          height={height - 120}
          itemCount={allLogs.length}
          itemSize={itemHeight}
          itemData={allLogs}
        >
          {Row}
        </List>
      </VirtualizedContainer>

      {/* Loading indicator for next page */}
      {isFetchingNextPage && (
        <Box display="flex" justifyContent="center" padding={2}>
          <CircularProgress size={20} />
        </Box>
      )}

      {/* Intersection observer target for infinite scrolling */}
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
