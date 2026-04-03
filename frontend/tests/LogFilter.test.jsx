import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogFilter from '../src/components/LogFilter';

describe('LogFilter Component', () => {
  it('should render filter inputs and call onFilterChange on submit', () => {
    const onFilterChange = vi.fn();
    render(<LogFilter onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText(/Agent/i), { target: { value: 'agent_test' } });
    fireEvent.change(screen.getByLabelText(/Trace ID/i), { target: { value: 'trace_123' } });

    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));
    expect(onFilterChange).toHaveBeenCalled();
  });
});
