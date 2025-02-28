import React, { useState } from 'react';
import { Modal, Box, Typography, IconButton, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  maxHeight: '90vh',
  overflowY: 'auto'
};

const LogDetailModal = ({ log, onClose }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Modal open={true} onClose={onClose} aria-labelledby="log-detail-title">
      <Box sx={style}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography id="log-detail-title" variant="h6" component="h2">
            Log Detail - Step {log.step_id}
          </Typography>
          <IconButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Typography variant="body1" sx={{ mt: 2 }}>
          <strong>Agent ID:</strong> {log.agent_id}
        </Typography>
        <Typography variant="body1">
          <strong>Trace ID:</strong> {log.trace_id}
        </Typography>
        <Typography variant="body1">
          <strong>User ID:</strong> {log.user_id}
        </Typography>
        <Typography variant="body1">
          <strong>Timestamp:</strong> {new Date(log.timestamp).toLocaleString()}
        </Typography>
        <Typography variant="body1" color={log.status === 'anomaly' ? 'error' : 'textPrimary'}>
          <strong>Status:</strong> {log.status}
        </Typography>
        <Typography variant="body1">
          <strong>Reviewed:</strong> {log.reviewed ? 'Yes' : 'No'}
        </Typography>
        {log.review_comments && (
          <Typography variant="body1">
            <strong>Review Comments:</strong> {log.review_comments}
          </Typography>
        )}
        {expanded && (
          <>
            <Typography variant="body1" sx={{ mt: 2 }}>
              <strong>Input Data:</strong>
              <pre>{JSON.stringify(log.input_data, null, 2)}</pre>
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              <strong>Output:</strong>
              <pre>{JSON.stringify(log.output, null, 2)}</pre>
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              <strong>Reasoning:</strong> {log.reasoning}
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              <strong>Metadata:</strong>
              <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
            </Typography>
          </>
        )}
        <Box textAlign="right" sx={{ mt: 2 }}>
          <button onClick={onClose}>Close</button>
        </Box>
      </Box>
    </Modal>
  );
};

export default LogDetailModal;
