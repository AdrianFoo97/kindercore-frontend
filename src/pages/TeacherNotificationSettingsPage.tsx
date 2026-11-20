import { useIsMobile } from '../hooks/useIsMobile.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import NotificationSettingsPage from './settings/NotificationSettingsPage.js';

// Teacher app → My Profile → Notifications (/teachers/:id/settings/notifications):
// the same choices as everyone's notification settings, in the teacher app's
// look (the floating top bar gives the back button).

const FONT = '"Segoe UI", Roboto, Arial, sans-serif';
const VIOLET = '#7c3aed';

export default function TeacherNotificationSettingsPage() {
  const { isMobile } = useIsMobile();
  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28, paddingRight: isMobile ? 16 : 32, paddingBottom: 40,
      paddingLeft: isMobile ? 16 : 32, minHeight: '100vh', fontFamily: FONT, background: '#f8fafc',
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 560, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 16px', paddingLeft: 4, fontSize: isMobile ? 30 : 24, fontWeight: 800, color: '#334155', letterSpacing: '-0.02em' }}>
          Notifications
        </h1>
        <NotificationSettingsPage embedded accent={VIOLET} />
      </div>
    </div>
  );
}
