import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

interface NotificationProps {
  message: string;
  onClose: () => void;
}

const Notification = ({ message, onClose }: NotificationProps) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [message]);

  const handleClose = (_event: unknown, reason?: string) => {
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
