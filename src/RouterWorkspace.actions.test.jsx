import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RouterWorkspace from './RouterWorkspace.jsx';

const router = { id: 4, name: 'Test NAS', host: '192.0.2.4', port: 8729, routerOsVersion: '7', status: 'Disabled' };
const reply = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
beforeEach(() => { localStorage.clear(); localStorage.setItem('pppoe_token', 'test-session'); vi.restoreAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Router/NAS edit and removal safeguards', () => {
  it('submits an owner-scoped update request and refreshes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply({ data: [router] })).mockResolvedValueOnce(reply({ data: { ...router, name: 'Renamed NAS' } })).mockResolvedValueOnce(reply({ data: [{ ...router, name: 'Renamed NAS' }] }));
    render(<RouterWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit router Test NAS' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed NAS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Router' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/routers/4');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).name).toBe('Renamed NAS');
    expect(await screen.findByRole('heading', { name: 'Renamed NAS' })).toBeTruthy();
  });
  it('never deletes when confirmation is declined', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply({ data: [router] }));
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<RouterWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit router Test NAS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Router' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('does not change the MikroTik configuration'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('sends DELETE after confirmation and refreshes software catalog', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply({ data: [router] })).mockResolvedValueOnce({ ok: true, status: 204 }).mockResolvedValueOnce(reply({ data: [] }));
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<RouterWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit router Test NAS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Router' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/routers/4');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(await screen.findByText('No routers registered.')).toBeTruthy();
  });
});
