import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RouterWorkspace from './RouterWorkspace.jsx';

beforeEach(() => { localStorage.clear(); localStorage.setItem('pppoe_token', 'test-session'); vi.restoreAllMocks(); });
afterEach(() => cleanup());
const reply = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

describe('Router/NAS workspace', () => {
  it('loads the owned router catalog with an authorization header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply({ data: [{ id: 4, name: 'Test NAS', host: '192.0.2.4', port: 8729, routerOsVersion: '7', status: 'Disabled' }] }));
    render(<RouterWorkspace />);
    expect(await screen.findByText('Test NAS')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/routers', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer test-session' }) }));
    expect(screen.getByText(/never displays stored passwords/i)).toBeTruthy();
  });
  it('submits a new router without credentials and refreshes the list', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply({ data: [] })).mockResolvedValueOnce(reply({ data: { id: 5 } }, 201)).mockResolvedValueOnce(reply({ data: [{ id: 5, name: 'New NAS', host: '192.0.2.5', port: 8729, routerOsVersion: '7', status: 'Disabled' }] }));
    render(<RouterWorkspace />);
    await screen.findByText('No routers registered.');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New NAS' } });
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: '192.0.2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Router' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [path, options] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/routers'); expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: 'New NAS', host: '192.0.2.5', port: 443, routerOsVersion: '7', status: 'Disabled' });
    expect(await screen.findByText('New NAS')).toBeTruthy();
  });
  it('surfaces API failures instead of claiming success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply({ error: 'Authentication required' }, 401));
    render(<RouterWorkspace />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Authentication required');
  });
});
