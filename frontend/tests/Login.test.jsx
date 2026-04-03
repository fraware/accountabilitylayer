import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../src/components/Login';
import api from '../src/services/api';

function renderLogin(ui) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

vi.mock('../src/services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form and handles successful login', async () => {
    const token = 'testtoken';
    api.post.mockResolvedValue({ data: { token } });
    const onLogin = vi.fn();

    renderLogin(<Login onLogin={onLogin} />);

    fireEvent.change(screen.getByTestId('login-username'), {
      target: { value: 'auditor1' },
    });
    fireEvent.change(screen.getByTestId('login-password'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(token);
    });
  });

  it('displays error on invalid credentials', async () => {
    api.post.mockRejectedValue(new Error('Invalid credentials'));

    renderLogin(<Login onLogin={() => {}} />);

    fireEvent.change(screen.getByTestId('login-username'), {
      target: { value: 'wrong' },
    });
    fireEvent.change(screen.getByTestId('login-password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
