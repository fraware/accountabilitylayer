import { useState, type FormEvent } from 'react';
import { Box, TextField, Button, Typography, Alert, CircularProgress } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import api from '../services/api';

interface LoginProps {
  onLogin: (token: string) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async ({ user, pass }: { user: string; pass: string }) => {
      const response = await api.post<{ token: string }>('/auth/login', {
        username: user,
        password: pass,
      });
      const token = response.data.token;
      if (!token) throw new Error('No token in response');
      return token;
    },
    retry: false,
    onSuccess: (token) => {
      setError('');
      onLogin(token);
    },
    onError: () => {
      setError('Invalid credentials');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ user: username, pass: password });
  };

  const pending = loginMutation.isPending;

  return (
    <Box
      sx={{
        maxWidth: 400,
        mx: 'auto',
        mt: 10,
        p: 2,
        border: '1px solid #ccc',
        borderRadius: 2,
      }}
    >
      <Typography variant="h5" align="center" gutterBottom>
        Login
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          margin="normal"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={pending}
          inputProps={{ 'data-testid': 'login-username' }}
        />
        <TextField
          fullWidth
          margin="normal"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={pending}
          inputProps={{ 'data-testid': 'login-password' }}
        />
        <Button
          fullWidth
          variant="contained"
          type="submit"
          sx={{ mt: 2 }}
          disabled={pending}
          startIcon={pending ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {pending ? 'Signing in…' : 'Login'}
        </Button>
      </form>
    </Box>
  );
};

export default Login;
