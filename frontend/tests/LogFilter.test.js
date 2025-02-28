import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import LogFilter from '../src/components/LogFilter';

describe('LogFilter Component', () => {
  it('should render filter inputs and call onFilterChange on submit', () => {
    const onFilterChange = jest.fn();
    render(<LogFilter onFilterChange={onFilterChange} />);

    // Fill in Agent and Trace ID fields.
    fireEvent.change(screen.getByLabelText(/Agent/i), { target: { value: 'agent_test' } });
    fireEvent.change(screen.getByLabelText(/Trace ID/i), { target: { value: 'trace_123' } });

    // Submit the form.
    fireEvent.click(screen.getByRole('button', { name: /Apply Filters/i }));
    expect(onFilterChange).toHaveBeenCalled();
  });
});
