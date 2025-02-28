import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import LogViewer from './components/LogViewer';
import UserProfile from './components/UserProfile';
import jwt_decode from 'jwt-decode';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({ username: '', email: '' });

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwt_decode(token);
        setRole(decoded.role);
        // In a real app, fetch user profile details from the backend.
        setUserProfile({ username: decoded.username, email: decoded.username + '@example.com' });
      } catch (error) {
        console.error("Invalid token", error);
        setToken('');
        localStorage.removeItem('token');
      }
    }
  }, [token]);

  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
  };

  const handleProfileSave = (profile) => {
    // Simulate saving updated profile info.
    setUserProfile(profile);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Accountability Layer Dashboard
          </Typography>
          <Typography variant="body1" sx={{ marginRight: 2 }}>
            Role: {role}
          </Typography>
          <Button color="inherit" onClick={() => setProfileOpen(true)}>
            Profile
          </Button>
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box p={2}>
        {role === 'auditor' || role === 'admin' ? (
          <Typography variant="subtitle1">
            Auditors/Admins: You have access to review and update logs.
          </Typography>
        ) : (
          <Typography variant="subtitle1">
            Agents: Limited dashboard view.
          </Typography>
        )}
        <LogViewer />
      </Box>
      <UserProfile
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userProfile={userProfile}
        onSave={handleProfileSave}
      />
    </div>
  );
};

export default App;
