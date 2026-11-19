import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChecklistModal } from '../../components/onboarding/ChecklistModal.js';

// jsdom doesn't scroll — the window scrolls to the next item to do.
Element.prototype.scrollTo = () => {};

describe('Onboarding checklist window', () => {
  it('shows an item’s link button, and pressing it doesn’t tick the item', () => {
    render(
      <MemoryRouter>
        <ChecklistModal subtitle="Aisha" onClose={() => {}} onSave={async () => {}}
          initialItems={[
            { task: 'Share the parent app', done: false, linkLabel: 'Get the app', linkUrl: 'https://kindertech.example/app' },
            { task: 'Collect birth certificate', done: false },
          ]} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Get the app/ });
    expect(link.getAttribute('href')).toBe('https://kindertech.example/app');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getAllByRole('link')).toHaveLength(1); // the plain item has no button
    fireEvent.click(link);
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(false);
  });

  it('shows a step’s description when you hover its ⓘ, and tapping it doesn’t tick the step', () => {
    render(
      <MemoryRouter>
        <ChecklistModal subtitle="Aisha" onClose={() => {}} onSave={async () => {}}
          initialItems={[{ task: 'Collect birth certificate', done: false, description: 'The original, not a photo.' }]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
    const info = screen.getByRole('button', { name: 'About this step' });
    fireEvent.mouseEnter(info.parentElement!);
    expect(screen.getByRole('tooltip').textContent).toBe('The original, not a photo.');
    fireEvent.click(info);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('offers the latest steps only when they differ, keeps ticks, and can discard the update before saving', async () => {
    const onSave = vi.fn(async (_items: unknown, _finish: boolean, _stepsChanged: boolean) => {});
    render(
      <MemoryRouter>
        <ChecklistModal subtitle="Aisha" onClose={() => {}} onSave={onSave}
          initialItems={[{ task: 'Collect birth certificate', done: true }, { task: 'Old step', done: false }]}
          templateTasks={['Collect birth certificate', 'Share the parent app']} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update to latest steps' }));
    expect(screen.getByText(/1 new, 1 removed/)).toBeTruthy();
    expect(screen.getByText('Share the parent app')).toBeTruthy();
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Discard update' }));
    expect(screen.getByText('Old step')).toBeTruthy();
    expect(screen.queryByText('Share the parent app')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update to latest steps' }));
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][2]).toBe(true);
  });

  it('says nothing when the checklist already has the latest steps', () => {
    render(
      <MemoryRouter>
        <ChecklistModal subtitle="Aisha" onClose={() => {}} onSave={async () => {}}
          initialItems={[{ task: 'Collect birth certificate', done: false }]} templateTasks={['Collect birth certificate']} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Update to latest steps' })).toBeNull();
  });
});
