import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import LogViewer from './LogViewer';
import UserProfile, { type UserProfileData } from './UserProfile';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import type { JwtPayload } from '../types/auth';

export default function DashboardLayout() {
  const { token, logout } = useAuth();
  const [role, setRole] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({
    username: '',
    email: '',
  });

  useEffect(() => {
    if (!token) return;
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      setRole(decoded.role);
      setUserProfile({
        username: decoded.username,
        email: `${decoded.username}@example.com`,
      });
    } catch (e) {
      console.error('Invalid token', e);
      logout();
    }
  }, [token, logout]);

  const handleProfileSave = (profile: UserProfileData) => {
    setUserProfile(profile);
  };

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
          <Button color="inherit" onClick={logout}>
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
          <Typography variant="subtitle1">Agents: Limited dashboard view.</Typography>
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
}
