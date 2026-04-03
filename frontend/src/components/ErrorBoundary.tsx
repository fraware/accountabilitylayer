import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <Box p={4} display="flex" justifyContent="center">
          <Paper sx={{ p: 4, maxWidth: 480 }}>
            <Typography variant="h6" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              The dashboard hit an unexpected error. You can reload the page to try again.
            </Typography>
            {import.meta.env.DEV ? (
              <Typography
                variant="caption"
                component="pre"
                sx={{
                  display: 'block',
                  whiteSpace: 'pre-wrap',
                  mb: 2,
                  color: 'error.main',
                }}
              >
                {String(this.state.error?.message || this.state.error)}
              </Typography>
            ) : null}
            <Button variant="contained" onClick={this.handleReload}>
              Reload page
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
