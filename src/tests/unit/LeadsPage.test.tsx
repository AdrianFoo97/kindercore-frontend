import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Hoist mocks so they apply before module imports
// Every leads-API function LeadsPage calls must exist on the mock — a
// missing one throws during render. Side panels / stats get empty results;
// the tests drive fetchLeads per case.
vi.mock('../../api/leads.js', () => ({
  fetchLeads: vi.fn(),
  createAppointment: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  restoreLead: vi.fn(),
  permanentDeleteLead: vi.fn(),
  confirmAppointment: vi.fn(),
  confirmAppointmentNoCalendar: vi.fn(),
  fetchTrashedLeads: vi.fn().mockResolvedValue([]),
  fetchUpcomingAppointments: vi.fn().mockResolvedValue([]),
  fetchLeadStats: vi.fn().mockResolvedValue({}),
  fetchLeadPhones: vi.fn().mockResolvedValue([]),
}));

// LeadsPage subscribes to live lead updates over Server-Sent Events;
// jsdom has no EventSource, so give it an inert one.
vi.stubGlobal('EventSource', class {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  addEventListener() {}
  removeEventListener() {}
  close() {}
});

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
          leadTemperature: null,
          deletedAt: null,
          promoCode: null,
          attended: false,
          visitOutcome: null,
          labels: [],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    expect(await screen.findByText('Ali')).toBeDefined();
    // The phone number is the WhatsApp entry point (it replaced the old
    // per-row "WhatsApp" button): a chat link with the local 0 swapped
    // for Malaysia's 60. jsdom's default 1024px width → WhatsApp Web.
    const phoneLink = screen.getByText('0123456789').closest('a');
    expect(phoneLink?.getAttribute('href')).toBe('https://web.whatsapp.com/send?phone=60123456789');
  });
});
