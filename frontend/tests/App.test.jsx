import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/context/AuthContext';
import App from '../src/App';

function wrap(ui) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthProvider>{ui}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('App', () => {
  it('renders login screen if not authenticated', () => {
    localStorage.removeItem('token');
    wrap(<App />);
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  });
});
