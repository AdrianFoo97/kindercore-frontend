import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import IncidentFormFields, {
  ADMIN_INCIDENT_THEME, emptyIncidentDraft, IncidentDraft,
} from '../../components/incidents/IncidentFormFields.js';

// The incident report form (teacher app + Operation → Incidents). Renders
// the real form fields; only the student list from the server is faked.

vi.mock('../../api/incidents.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../api/incidents.js')>()),
  fetchIncidentStudentOptions: vi.fn().mockResolvedValue([
    { id: 's-1', childName: 'Aiden', age: 4 },
    { id: 's-2', childName: 'Bella', age: 5 },
  ]),
}));

let latest: IncidentDraft;
function Harness() {
  const [draft, setDraft] = useState<IncidentDraft>(emptyIncidentDraft);
  latest = draft;
  return <IncidentFormFields value={draft} onChange={setDraft} theme={ADMIN_INCIDENT_THEME} />;
}

const renderForm = () => render(
  <QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>,
);

describe('Incident report form', () => {
  it('keeps a picked student when you click elsewhere in the Students field', async () => {
    renderForm();
    fireEvent.focus(screen.getByLabelText('Search students'));
    fireEvent.click(await screen.findByRole('option', { name: 'Aiden' }));
    expect(latest.studentIds).toEqual(['s-1']);

    // Click the field's own caption — empty space, "outside the list".
    fireEvent.click(screen.getByText('Students involved'));
    await waitFor(() => expect(latest.studentIds).toEqual(['s-1']));
    expect(screen.getByRole('button', { name: 'Remove Aiden' })).toBeTruthy();
  });

  it('groups the student list by age', async () => {
    renderForm();
    fireEvent.focus(screen.getByLabelText('Search students'));
    expect(await screen.findByRole('group', { name: 'Age 4' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Age 5' })).toBeTruthy();
  });

  it('turns the hour, minute and AM/PM dropdowns into a 24-hour time only once all three are picked', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Minute'), { target: { value: '30' } });
    expect(latest.incidentTime).toBe('');
    fireEvent.change(screen.getByLabelText('AM or PM'), { target: { value: 'PM' } });
    expect(latest.incidentTime).toBe('14:30');
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('AM or PM'), { target: { value: 'AM' } });
    expect(latest.incidentTime).toBe('00:30');
  });
});
