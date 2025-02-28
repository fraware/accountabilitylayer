import React, { useState } from 'react';
import { Modal, Box, Typography, TextField, Button } from '@mui/material';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '50%',
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4
};

const UserProfile = ({ open, onClose, userProfile, onSave }) => {
  const [profile, setProfile] = useState(userProfile);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    onSave(profile);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="user-profile-title">
      <Box sx={style}>
        <Typography id="user-profile-title" variant="h6" component="h2">
          User Profile & Settings
        </Typography>
        <TextField
          fullWidth
          margin="normal"
          label="Username"
          name="username"
          value={profile.username}
          onChange={handleChange}
        />
        <TextField
          fullWidth
          margin="normal"
          label="Email"
          name="email"
          value={profile.email}
          onChange={handleChange}
        />
        <Button variant="contained" onClick={handleSave} sx={{ mt: 2 }}>
          Save
        </Button>
      </Box>
    </Modal>
  );
};

export default UserProfile;
