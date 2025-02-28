import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import '@testing-library/jest-dom';

test('renders login screen if not authenticated', () => {
  localStorage.removeItem('token');
  render(<App />);
  expect(screen.getByText(/login/i)).toBeInTheDocument();
});
