import React, { useState } from 'react';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem, Button, Chip } from '@mui/material';
import { DatePicker } from '@mui/lab';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import LocalizationProvider from '@mui/lab/LocalizationProvider';

const LogFilter = ({ onFilterChange }) => {
  const [agent, setAgent] = useState('');
  const [traceId, setTraceId] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [reviewed, setReviewed] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onFilterChange({
      agent,
      traceId,
      status: statuses.join(','), // Pass comma‑separated statuses.
      reviewed,
      fromDate: fromDate ? fromDate.toISOString().split('T')[0] : '',
      toDate: toDate ? toDate.toISOString().split('T')[0] : '',
      keyword
    });
  };

  const handleStatusChange = (event) => {
    const { value } = event.target;
    setStatuses(typeof value === 'string' ? value.split(',') : value);
  };

  const presetToday = () => {
    const today = new Date();
    setFromDate(today);
    setToDate(today);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <form onSubmit={handleSubmit}>
        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
          <TextField
            label="Agent"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          />
          <TextField
            label="Trace ID"
            value={traceId}
            onChange={(e) => setTraceId(e.target.value)}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              multiple
              value={statuses}
              onChange={handleStatusChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} />
                  ))}
                </Box>
              )}
            >
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failure">Failure</MenuItem>
              <MenuItem value="anomaly">Anomaly</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Reviewed</InputLabel>
            <Select
              label="Reviewed"
              value={reviewed}
              onChange={(e) => setReviewed(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Reviewed</MenuItem>
              <MenuItem value="false">Unreviewed</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <DatePicker
            label="From Date"
            value={fromDate}
            onChange={(newValue) => setFromDate(newValue)}
            renderInput={(params) => <TextField {...params} />}
          />
          <DatePicker
            label="To Date"
            value={toDate}
            onChange={(newValue) => setToDate(newValue)}
            renderInput={(params) => <TextField {...params} />}
          />
          <Button variant="outlined" onClick={presetToday}>
            Today
          </Button>
          <Button type="submit" variant="contained">
            Apply Filters
          </Button>
        </Box>
      </form>
    </LocalizationProvider>
  );
};

export default LogFilter;
