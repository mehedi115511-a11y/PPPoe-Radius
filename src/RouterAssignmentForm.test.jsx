import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RouterAssignmentForm from './RouterAssignmentForm.jsx';

afterEach(() => cleanup());
const router = { id: 9, name: 'Test NAS' };

describe('manual router assignment form', () => {
  it('requires a valid exact ID and submits explicit client identity', async () => {
    const onAssign = vi.fn().mockResolvedValue(true);
    render(<RouterAssignmentForm router={router} busy={false} onAssign={onAssign} />);
    const input = screen.getByLabelText('Exact record ID');
    const submit = screen.getByRole('button', { name: 'Assign record' });
    expect(submit.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '0' } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '17' } });
    fireEvent.click(submit);
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith(9, { kind: 'client', recordId: '17' }));
    await waitFor(() => expect(input.value).toBe(''));
  });
  it('preserves input on rejected assignment and supports explicit package type', async () => {
    const onAssign = vi.fn().mockResolvedValue(false);
    render(<RouterAssignmentForm router={router} busy={false} onAssign={onAssign} />);
    fireEvent.change(screen.getByLabelText('Record type'), { target: { value: 'package' } });
    const input = screen.getByLabelText('Exact record ID');
    fireEvent.change(input, { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign record' }));
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith(9, { kind: 'package', recordId: '24' }));
    expect(input.value).toBe('24');
  });
});
