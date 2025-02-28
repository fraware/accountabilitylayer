import React, { useEffect } from 'react';
import { Alert, Snackbar } from '@mui/material';

const Notification = ({ message, onClose }) => {
  const [open, setOpen] = React.useState(true);

  useEffect(() => {
    setOpen(true);
  }, [message]);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
    onClose();
  };

  return (
    <Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
      <Alert onClose={handleClose} severity="warning" sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Notification;
