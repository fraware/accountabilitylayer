import { useState } from 'react';
import LogFilter from './LogFilter';
import LogDetailModal from './LogDetailModal';
import VirtualizedLogTable from './VirtualizedLogTable';
import { Typography, Box } from '@mui/material';
import type { LogDocument, LogSearchFilters } from '../types/logs';

const LogViewer = () => {
  const [filters, setFilters] = useState<LogSearchFilters>({});
  const [selectedLog, setSelectedLog] = useState<LogDocument | null>(null);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Audit Trail Dashboard
      </Typography>
      <LogFilter onFilterChange={setFilters} />
      <Box mt={2}>
        <VirtualizedLogTable
          filters={filters}
          selectedLogId={selectedLog?._id ?? null}
          onLogSelect={(log) => setSelectedLog(log)}
          height={640}
        />
      </Box>
      {selectedLog ? (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      ) : null}
    </Box>
  );
};

export default LogViewer;
