import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import Login from '../src/components/Login';
import api from '../src/services/api';

jest.mock('../src/services/api');

describe('Login Component', () => {
  it('renders login form and handles successful login', async () => {
    const token = 'testtoken';
    api.post.mockResolvedValue({ data: { token } });
    const onLogin = jest.fn();

    render(<Login onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'auditor1' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password' }
    });
    fireEvent.click(screen.getByText(/login/i));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(token);
    });
  });

  it('displays error on invalid credentials', async () => {
    api.post.mockRejectedValue(new Error('Invalid credentials'));

    render(<Login onLogin={() => {}} />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'wrong' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' }
    });
    fireEvent.click(screen.getByText(/login/i));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
