import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import LogFilter from './LogFilter';
import LogDetailModal from './LogDetailModal';
import { io } from 'socket.io-client';
import Notification from './Notification';
import { Typography, Box } from '@mui/material';

const socket = io('http://localhost:5000'); // Connect to backend Socket.IO server

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [notification, setNotification] = useState(null);

  // Fetch logs based on current filters.
  const fetchLogs = useCallback(async () => {
    try {
      let query = [];
      if (filters.agent) query.push(`agent_id=${filters.agent}`);
      if (filters.traceId) query.push(`trace_id=${filters.traceId}`);
      if (filters.status) query.push(`status=${filters.status}`);
      if (filters.keyword) query.push(`keyword=${filters.keyword}`);
      if (filters.fromDate) query.push(`from_date=${filters.fromDate}`);
      if (filters.toDate) query.push(`to_date=${filters.toDate}`);
      const queryString = query.length ? `?${query.join('&')}` : '';
      const response = await api.get(`/logs/search${queryString}`);
      let filteredLogs = response.data.data;
      if (filters.reviewed) {
        filteredLogs = filteredLogs.filter(
          (log) => String(log.reviewed) === filters.reviewed
        );
      }
      setLogs(filteredLogs);
    } catch (error) {
      console.error(error);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
    // Set up WebSocket event listeners.
    socket.on('new_log', (newLog) => {
      setLogs((prevLogs) => [newLog, ...prevLogs]);
      if (newLog.status === 'anomaly') {
        setNotification(`New anomaly detected for agent ${newLog.agent_id}`);
      }
    });

    socket.on('update_log', (updatedLog) => {
      setLogs((prevLogs) =>
        prevLogs.map((log) =>
          log._id === updatedLog._id ? updatedLog : log
        )
      );
    });

    return () => {
      socket.off('new_log');
      socket.off('update_log');
    };
  }, [fetchLogs]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Audit Trail Dashboard
      </Typography>
      <LogFilter onFilterChange={handleFilterChange} />
      <Box mt={2}>
        {logs.map((log) => (
          <Box
            key={log._id}
            onClick={() => setSelectedLog(log)}
            sx={{
              border: '1px solid #ccc',
              padding: '10px',
              margin: '10px 0',
              cursor: 'pointer'
            }}
          >
            <Typography>
              <strong>Step:</strong> {log.step_id} | <strong>Status:</strong>{' '}
              <span style={log.status === 'anomaly' ? { color: 'red', fontWeight: 'bold' } : {}}>
                {log.status}
              </span>
            </Typography>
            <Typography>{new Date(log.timestamp).toLocaleString()}</Typography>
          </Box>
        ))}
      </Box>
      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
      {notification && (
        <Notification message={notification} onClose={() => setNotification(null)} />
      )}
    </Box>
  );
};

export default LogViewer;
