import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Hoist mocks so they apply before module imports
vi.mock('../../api/leads.js', () => ({
  fetchLeads: vi.fn(),
  createAppointment: vi.fn(),
}));

import LeadsPage from '../../pages/LeadsPage.js';
import { fetchLeads } from '../../api/leads.js';

const mockedFetchLeads = vi.mocked(fetchLeads);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/leads']}>
        <Routes>
          <Route path="/leads" element={<LeadsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LeadsPage', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    vi.clearAllMocks();
  });

  it('shows loading state while fetch is pending', () => {
    mockedFetchLeads.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('shows error message when fetch fails', async () => {
    mockedFetchLeads.mockRejectedValue(new Error('Network error'));
    renderPage();
    const errorEl = await screen.findByText(/Error: Network error/);
    expect(errorEl).toBeDefined();
  });

  it('renders leads table after data loads', async () => {
    mockedFetchLeads.mockResolvedValue({
      items: [
        {
          id: '1',
          submittedAt: new Date().toISOString(),
          childName: 'Ali',
          parentPhone: '0123456789',
          childDob: '2020-01-01',
          enrolmentYear: 2025,
          status: 'NEW',
          notes: null,
          appointmentStart: null,
          appointmentEnd: null,
          googleEventId: null,
          googleEventLink: null,
          appointmentCreatedByUserId: null,
          appointmentIsPlaceholder: false,
          lostReason: null,
          relationship: null,
          programme: null,
          preferredAppointmentTime: null,
          addressLocation: null,
          needsTransport: null,
          howDidYouKnow: null,
          statusChangedAt: null,
          ctaSource: null,
          utmSource: null,
          deletedAt: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    expect(await screen.findByText('Ali')).toBeDefined();
    expect(screen.getByText('0123456789')).toBeDefined();
    expect(screen.getByText('WhatsApp')).toBeDefined();
  });
});
