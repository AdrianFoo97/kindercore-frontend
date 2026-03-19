import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { apiFetch } from '../api/client.js';

type Tool = 'reset-leads' | 'reset-students' | 'seed-dummy';

export default function TestToolsPage({ tool }: { tool: Tool }) {
  const [status, setStatus] = useState<'idle' | 'confirming' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');

  const config = {
    'reset-leads': {
      title: 'Reset All Leads',
      description: 'Permanently deletes every lead in the database. This cannot be undone.',
      confirmLabel: 'Yes, delete all leads',
      action: async () => { await apiFetch('/api/leads/reset', { method: 'DELETE' }); return { message: 'All leads have been deleted.', note: '' }; },
    },
    'reset-students': {
      title: 'Reset All Students',
      description: 'Permanently deletes every student record in the database. This cannot be undone.',
      confirmLabel: 'Yes, delete all students',
      action: async () => { await apiFetch('/api/students/reset', { method: 'DELETE' }); return { message: 'All students have been deleted.', note: '' }; },
    },
    'seed-dummy': {
      title: 'Seed Dummy Leads',
      description: 'Inserts dummy leads covering all statuses (NEW, Contacted, Appt Booked, Follow-Up, Enrolled, Lost) with realistic data. Enrolled leads also create linked student records.',
      confirmLabel: 'Yes, seed dummy leads',
      action: async () => {
        const res = await apiFetch<{ message: string; students?: number; skippedStudents?: number; note?: string }>('/api/leads/seed-dummy', { method: 'POST' });
        return { message: res.message, note: res.note ?? '' };
      },
    },
  }[tool];

  async function handleConfirm() {
    setStatus('loading');
    try {
      const result = await config.action();
      setStatus('done');
      setMessage(result.message);
      setNote(result.note);
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a202c', marginBottom: 8 }}>{config.title}</h2>
      <p style={{ fontSize: 14, color: '#718096', marginBottom: 32 }}>{config.description}</p>

      {status === 'idle' && (
        <button
          onClick={() => setStatus('confirming')}
          style={{ padding: '10px 20px', background: tool === 'seed-dummy' ? '#38a169' : '#e53e3e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          {config.title}
        </button>
      )}

      {status === 'confirming' && (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 10, padding: 20 }}>
          <p style={{ fontWeight: 600, color: '#c53030', marginBottom: 16, fontSize: 14 }}>
            Are you sure? This action is irreversible.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleConfirm}
              style={{ padding: '8px 18px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {config.confirmLabel}
            </button>
            <button
              onClick={() => setStatus('idle')}
              style={{ padding: '8px 18px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <p style={{ color: '#718096', fontSize: 14 }}>Deleting...</p>
      )}

      {status === 'done' && (
        <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 10, padding: 16 }}>
          <p style={{ color: '#276749', fontWeight: 600, fontSize: 14, margin: 0 }}>
            {message}
            {note && <> <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginLeft: 6, color: '#d69e2e' }} /> {note}</>}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 10, padding: 16 }}>
          <p style={{ color: '#c53030', fontSize: 14, margin: 0 }}>{message}</p>
        </div>
      )}
    </div>
  );
}
