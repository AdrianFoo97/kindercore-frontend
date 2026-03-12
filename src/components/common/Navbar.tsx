import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useMatch } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { name: string; role: string }) : null;
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [leadsHover, setLeadsHover] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const studentsRef = useRef<HTMLDivElement>(null);
  const onAnalysisRoute = !!useMatch('/analysis/*');
  const onSettingsRoute = !!useMatch('/settings/*');
  const studentsMatch = useMatch('/students');
  const onboardingMatch = useMatch('/onboarding');
  const onStudentsRoute = !!(studentsMatch || onboardingMatch);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (analysisRef.current && !analysisRef.current.contains(e.target as Node)) setAnalysisOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
      if (studentsRef.current && !studentsRef.current.contains(e.target as Node)) setStudentsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <>
    <style>{`
      .nav-drop-item:hover { background: #ebf4ff !important; color: #2b6cb0 !important; }
      .nav-link:hover { color: #fff !important; background: rgba(255,255,255,0.12); }
    `}</style>
    <nav style={styles.nav}>
      <span style={styles.brand}>KinderCore</span>

      <div style={styles.links}>
        {/* Leads link */}
        <NavLink
          to="/leads"
          end
          className="nav-link"
          style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.activeLink : {}) })}
        >
          Leads
        </NavLink>

        {/* Students dropdown */}
        <div ref={studentsRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setStudentsOpen(o => !o)}
            className="nav-link"
            style={{ ...styles.link, ...styles.dropBtn, ...(onStudentsRoute ? styles.activeLink : {}) }}
          >
            Students ▾
          </button>
          {studentsOpen && (
            <div style={styles.dropdown}>
              <NavLink
                to="/students"
                className="nav-drop-item"
                style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                onClick={() => setStudentsOpen(false)}
              >
                Student List
              </NavLink>
              <NavLink
                to="/onboarding"
                className="nav-drop-item"
                style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                onClick={() => setStudentsOpen(false)}
              >
                Onboarding
              </NavLink>
            </div>
          )}
        </div>

        <NavLink
          to="/packages"
          className="nav-link"
          style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.activeLink : {}) })}
        >
          Packages
        </NavLink>

        {/* Analysis dropdown */}
        <div ref={analysisRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAnalysisOpen(o => !o)}
            className="nav-link"
            style={{ ...styles.link, ...styles.dropBtn, ...(onAnalysisRoute ? styles.activeLink : {}) }}
          >
            Analysis ▾
          </button>
          {analysisOpen && (
            <div style={styles.dropdown}>
              <NavLink
                to="/analysis/sales-marketing"
                className="nav-drop-item"
                style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                onClick={() => setAnalysisOpen(false)}
              >
                Marketing Analysis
              </NavLink>
              <NavLink
                to="/analysis/sales"
                className="nav-drop-item"
                style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                onClick={() => setAnalysisOpen(false)}
              >
                Sales Analysis
              </NavLink>
            </div>
          )}
        </div>

        {/* Settings dropdown — admin only */}
        {user?.role === 'ADMIN' && (
          <div ref={settingsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              className="nav-link"
              style={{ ...styles.link, ...styles.dropBtn, ...(onSettingsRoute ? styles.activeLink : {}) }}
            >
              Settings ▾
            </button>
            {settingsOpen && (
              <div style={styles.dropdown}>
                <div
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setLeadsHover(true)}
                  onMouseLeave={() => setLeadsHover(false)}
                >
                  <div style={{ ...styles.dropItem, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default', ...(leadsHover ? { background: '#ebf4ff', color: '#2b6cb0' } : {}) }}>
                    Leads
                    <span style={{ fontSize: 10, marginLeft: 8, color: leadsHover ? '#2b6cb0' : '#a0aec0' }}>▶</span>
                  </div>
                  {leadsHover && (
                    <div style={styles.subDropdown}>
                      <NavLink
                        to="/settings/leads/whatsapp-appointment"
                        className="nav-drop-item"
                        style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                        onClick={() => { setSettingsOpen(false); setLeadsHover(false); }}
                      >
                        Appt. Template
                      </NavLink>
                      <NavLink
                        to="/settings/leads/whatsapp-followup"
                        className="nav-drop-item"
                        style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                        onClick={() => { setSettingsOpen(false); setLeadsHover(false); }}
                      >
                        Follow-up Template
                      </NavLink>
                      <NavLink
                        to="/settings/leads/status"
                        className="nav-drop-item"
                        style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                        onClick={() => { setSettingsOpen(false); setLeadsHover(false); }}
                      >
                        Status
                      </NavLink>
                      <NavLink
                        to="/leads/import"
                        className="nav-drop-item"
                        style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                        onClick={() => { setSettingsOpen(false); setLeadsHover(false); }}
                      >
                        Import Leads
                      </NavLink>
                    </div>
                  )}
                </div>
                <NavLink
                  to="/settings/packages"
                  className="nav-drop-item"
                  style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                  onClick={() => setSettingsOpen(false)}
                >
                  Packages
                </NavLink>
                <NavLink
                  to="/settings/onboarding"
                  className="nav-drop-item"
                  style={({ isActive }) => ({ ...styles.dropItem, ...(isActive ? styles.dropItemActive : {}) })}
                  onClick={() => setSettingsOpen(false)}
                >
                  Student Onboarding
                </NavLink>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={styles.right}>
        {user && <span style={styles.userName}>{user.name}</span>}
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </nav>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    height: 52,
    background: '#2b6cb0',
    color: '#fff',
    gap: 24,
    fontFamily: 'system-ui, sans-serif',
  },
  brand: {
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: '-0.5px',
    color: '#fff',
    marginRight: 8,
  },
  links: { display: 'flex', gap: 4, flex: 1, alignItems: 'center' },
  link: {
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 700,
  },
  activeLink: {
    color: '#fff',
    background: 'rgba(255,255,255,0.15)',
  },
  dropBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'inherit',
  },
  dropdown: {
    position: 'absolute',
    top: '110%',
    left: 0,
    background: '#fff',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    minWidth: 160,
    zIndex: 100,
  },
  dropItem: {
    display: 'block',
    padding: '10px 16px',
    color: '#2d3748',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  dropItemActive: {
    background: '#ebf8ff',
    color: '#2b6cb0',
  },
  subDropdown: {
    position: 'absolute',
    top: 0,
    left: '100%',
    background: '#fff',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    minWidth: 180,
    zIndex: 101,
    overflow: 'hidden',
  },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
  userName: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  logoutBtn: {
    padding: '5px 12px',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
};
