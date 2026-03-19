import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../api/settings.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faArrowUpRightFromSquare, faUsers, faGraduationCap, faBoxesStacked, faMessage, faPlug, faFileImport, faBars } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export default function Navbar() {
  const { isMobile, isTablet } = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { name: string; role: string }) : null;
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [whatsappModal, setWhatsappModal] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waTemplate, setWaTemplate] = useState('none');
  const [waLang, setWaLang] = useState<'en' | 'zh'>('en');
  const analysisRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const studentsRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const devRef = useRef<HTMLDivElement>(null);
  const onToolsRoute = !!useMatch('/tools/*');
  const onDevRoute = !!useMatch('/settings/test/*');
  const onAnalysisRoute = !!useMatch('/analysis/*');
  const onSettingsRoute = !!useMatch('/settings/*');
  const studentsMatch = useMatch('/students');
  const onboardingMatch = useMatch('/onboarding');
  const onStudentsRoute = !!(studentsMatch || onboardingMatch);

  // Templates for WhatsApp modal
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  interface TplOption { id: string; name: string; en: string; zh: string; }
  const waTemplates: TplOption[] = [
    { id: 'enquiry', name: 'Enquiry', en: String(settings?.whatsapp_template ?? ''), zh: String(settings?.whatsapp_template_zh ?? '') },
    { id: 'follow_up', name: 'Follow Up', en: String(settings?.whatsapp_followup_template ?? ''), zh: String(settings?.whatsapp_followup_template_zh ?? '') },
    ...(Array.isArray(settings?.whatsapp_custom_templates)
      ? (settings.whatsapp_custom_templates as { id: string; name: string; content_en: string; content_zh: string }[]).map(t => ({
          id: t.id, name: t.name, en: t.content_en, zh: t.content_zh,
        }))
      : []),
  ];

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (analysisRef.current && !analysisRef.current.contains(e.target as Node)) setAnalysisOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
      if (studentsRef.current && !studentsRef.current.contains(e.target as Node)) setStudentsOpen(false);
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
      if (devRef.current && !devRef.current.contains(e.target as Node)) setDevOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // Close mobile menu on navigate
  useEffect(() => { setMobileMenuOpen(false); }, [isMobile]);

  const closeAll = () => { setMobileMenuOpen(false); setAnalysisOpen(false); setSettingsOpen(false); setStudentsOpen(false); setToolsOpen(false); setDevOpen(false); };

  // Shared nav items renderer (used for both desktop and mobile drawer)
  const renderNavItems = (mobile = false) => {
    const mLink: React.CSSProperties = mobile
      ? { display: 'block', padding: '12px 20px', color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 500, borderBottom: '1px solid #f1f5f9' }
      : {};
    const mLinkActive: React.CSSProperties = mobile
      ? { color: '#3c339a', fontWeight: 600, background: '#eef0fa' }
      : {};
    const mDropBtn: React.CSSProperties = mobile
      ? { ...mLink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: 'none', cursor: 'pointer', background: 'none', fontFamily: 'inherit', textAlign: 'left' as const }
      : { ...styles.link, ...styles.dropBtn };
    const mPanel: React.CSSProperties = mobile
      ? { background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }
      : styles.panel;
    const mPanelItem: React.CSSProperties = mobile
      ? { display: 'block', padding: '10px 20px 10px 36px', color: '#374151', textDecoration: 'none', fontSize: 14 }
      : styles.panelItem;

    return (
      <>
        {/* Leads link */}
        <NavLink to="/leads" end onClick={closeAll}
          className={mobile ? '' : 'nav-link'}
          style={({ isActive }) => mobile
            ? { ...mLink, ...(isActive ? mLinkActive : {}) }
            : { ...styles.link, ...(isActive ? styles.activeLink : {}) }
          }>Leads</NavLink>

        {/* Students dropdown */}
        <div ref={mobile ? undefined : studentsRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setStudentsOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onStudentsRoute && !mobile ? styles.activeLink : {}), ...(onStudentsRoute && mobile ? mLinkActive : {}) }}>
            Students {mobile ? (studentsOpen ? '−' : '+') : '▾'}
          </button>
          {studentsOpen && (
            <div style={mPanel}>
              <NavLink to="/students" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Student List</NavLink>
              <NavLink to="/onboarding" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Onboarding</NavLink>
            </div>
          )}
        </div>

        {/* Analysis dropdown */}
        <div ref={mobile ? undefined : analysisRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setAnalysisOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onAnalysisRoute && !mobile ? styles.activeLink : {}), ...(onAnalysisRoute && mobile ? mLinkActive : {}) }}>
            Analysis {mobile ? (analysisOpen ? '−' : '+') : '▾'}
          </button>
          {analysisOpen && (
            <div style={mPanel}>
              <NavLink to="/analysis/sales-marketing" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Marketing Analysis</NavLink>
              <NavLink to="/analysis/sales" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Sales Analysis</NavLink>
            </div>
          )}
        </div>

        {/* Tools dropdown */}
        <div ref={mobile ? undefined : toolsRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setToolsOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onToolsRoute && !mobile ? styles.activeLink : {}) }}>
            Tools {mobile ? (toolsOpen ? '−' : '+') : '▾'}
          </button>
          {toolsOpen && (
            <div style={mPanel}>
              <button
                className={mobile ? '' : 'nav-drop-item'}
                style={{ ...mPanelItem, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' as const, background: 'none', fontFamily: 'inherit' }}
                onClick={() => { closeAll(); setWaPhone(''); setWaMessage(''); setWaTemplate('none'); setWaLang('en'); setWhatsappModal(true); }}>
                Open WhatsApp
              </button>
              <button
                className={mobile ? '' : 'nav-drop-item'}
                style={{ ...mPanelItem, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' as const, background: 'none', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => { closeAll(); window.open('/enquiry', '_blank'); }}>
                Landing Page <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 9, opacity: 0.6 }} />
              </button>
            </div>
          )}
        </div>

        {/* Settings dropdown — admin only */}
        {user?.role === 'ADMIN' && (
          <div ref={mobile ? undefined : settingsRef} style={mobile ? {} : { position: 'relative' }}>
            <button onClick={() => setSettingsOpen(o => !o)} className={mobile ? '' : 'nav-link'}
              style={{ ...mDropBtn, ...(onSettingsRoute && !mobile ? styles.activeLink : {}), ...(onSettingsRoute && mobile ? mLinkActive : {}) }}>
              Settings {mobile ? (settingsOpen ? '−' : '+') : '▾'}
            </button>
            {settingsOpen && (() => {
              const close = () => closeAll();
              const sep = mobile
                ? <div style={{ height: 1, background: '#e5e7eb', margin: '2px 20px' }} />
                : <div style={{ height: 1, background: '#f0f0f0', margin: '6px 0' }} />;
              const section = (icon: typeof faUsers, label: string) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: mobile ? '10px 20px 5px' : '10px 16px 5px', fontSize: 10, fontWeight: 700, color: '#8893a7', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  <FontAwesomeIcon icon={icon} style={{ fontSize: 10, width: 12, color: '#b0b8c9' }} />
                  {label}
                </div>
              );
              const link = (to: string, label: string) => (
                <NavLink to={to} className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({
                    display: 'block', padding: mobile ? '8px 20px 8px 44px' : '6px 16px 6px 35px', fontSize: 13, textDecoration: 'none',
                    color: isActive ? '#3c339a' : '#374151',
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? '#eef0fa' : 'none',
                    borderRadius: 0,
                  })}
                  onClick={close}>{label}</NavLink>
              );
              return (
                <div style={mobile ? { ...mPanel } : { position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)', minWidth: 230, zIndex: 100, padding: '4px 0', border: '1px solid #e5e7eb' }}>
                  {section(faUsers, 'CRM')}
                  {link('/settings/leads', 'Leads')}
                  {sep}
                  {section(faGraduationCap, 'Students')}
                  {link('/settings/onboarding', 'Onboarding Tasks')}
                  {sep}
                  {section(faBoxesStacked, 'Packages & Pricing')}
                  {link('/settings/packages/programmes', 'Programmes')}
                  {link('/settings/packages/age-groups', 'Age Groups')}
                  {link('/settings/packages/assignment', 'Package Assignment')}
                  {link('/packages', 'Pricing')}
                  {sep}
                  {section(faMessage, 'Communication')}
                  {link('/settings/whatsapp-templates', 'Message Templates')}
                  {sep}
                  {section(faPlug, 'Integrations')}
                  {link('/settings/calendar', 'Google Calendar')}
                  {sep}
                  {section(faFileImport, 'Data')}
                  {link('/leads/import', 'Import Leads')}
                  {link('/students/import', 'Import Students')}
                </div>
              );
            })()}
          </div>
        )}

        {/* Dev tools — development only */}
        {import.meta.env.DEV && (
          <div ref={mobile ? undefined : devRef} style={mobile ? {} : { position: 'relative' }}>
            <button onClick={() => setDevOpen(o => !o)} className={mobile ? '' : 'nav-link'}
              style={{ ...mDropBtn, ...(onDevRoute && !mobile ? { ...styles.activeLink } : {}), ...(mobile ? {} : { color: '#fde68a' }) }}>
              Dev {mobile ? (devOpen ? '−' : '+') : '▾'}
            </button>
            {devOpen && (
              <div style={mPanel}>
                <NavLink to="/settings/test/reset-leads" onClick={closeAll}
                  className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Reset Leads</NavLink>
                <NavLink to="/settings/test/reset-students" onClick={closeAll}
                  className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Reset Students</NavLink>
                <NavLink to="/settings/test/seed-dummy" onClick={closeAll}
                  className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Seed Dummy Leads</NavLink>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <>
    <style>{`
      .nav-drop-item:hover { background: #f1f5f9 !important; }
      .nav-link { transition: all 0.12s ease; }
      .nav-link:hover { color: #fff !important; background: rgba(255,255,255,0.1); }
    `}</style>
    <nav style={{ ...styles.nav, padding: isTablet ? '0 12px' : '0 24px' }}>
      {/* ── Mobile/Tablet: hamburger on left ── */}
      {isTablet && (
        <button onClick={() => setMobileMenuOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '4px 8px', marginRight: 8 }}>
          <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} />
        </button>
      )}

      <span style={styles.brand}>KinderTech</span>

      {/* ── Desktop nav ── */}
      {!isTablet && (
        <>
          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
          <div style={styles.links}>{renderNavItems(false)}</div>
          <div style={styles.right}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div>
                <span style={styles.userName}>{user.name}</span>
              </div>
            )}
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)' }} />
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </div>
        </>
      )}
    </nav>

    {/* ── Mobile drawer ── */}
    {isTablet && mobileMenuOpen && (
      <>
        <div onClick={closeAll} style={{ position: 'fixed', inset: 0, top: 50, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
        <div style={{ position: 'fixed', top: 50, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 100, overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          {renderNavItems(true)}
          {/* User info + logout at bottom */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...styles.avatar, background: '#5a79c8', color: '#fff' }}>{user.name.charAt(0).toUpperCase()}</div>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{user.name}</span>
              </div>
            )}
            <button onClick={handleLogout} style={{ padding: '6px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Logout
            </button>
          </div>
        </div>
      </>
    )}
    {whatsappModal && (() => {
      const raw = waPhone.replace(/[\s\-()]/g, '');
      const normalized = raw.startsWith('+') ? raw.replace(/\D/g, '')
        : raw.startsWith('0') ? '60' + raw.slice(1)
        : /^(60|65|62|66|63|91|44|1)\d+$/.test(raw) ? raw
        : '60' + raw;
      const valid = normalized.length >= 10;
      const open = () => {
        if (!valid) return;
        const url = waMessage.trim()
          ? `https://web.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(waMessage.trim())}`
          : `https://web.whatsapp.com/send?phone=${normalized}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        setWhatsappModal(false);
      };
      return (
        <div style={modal.overlay} onClick={() => setWhatsappModal(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' as const }} onClick={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={modal.waIcon}>
                    <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 16, color: '#fff' }} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Send WhatsApp</h2>
                  </div>
                </div>
                <button onClick={() => setWhatsappModal(false)} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#b0b8c9', padding: '2px 4px', lineHeight: 1 }}><FontAwesomeIcon icon={faXmark} /></button>
              </div>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Phone */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#8893a7', textTransform: 'uppercase' as const, letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>To</label>
                <input
                  autoFocus
                  style={{ ...modal.input, borderColor: waPhone ? (valid ? '#5b9a6f' : '#c47272') : '#e2e8f0' }}
                  placeholder="e.g. 0123456789 or 6591234567"
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && open()}
                />
                {waPhone && (
                  <span style={{ fontSize: 11, color: valid ? '#5b9a6f' : '#c47272', marginTop: 3, display: 'block' }}>
                    {valid ? `+${normalized}` : 'Enter a valid phone number'}
                  </span>
                )}
              </div>

              {/* Message */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#8893a7', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Message</label>
                  <div style={{ flex: 1 }} />
                  <select
                    value={waTemplate}
                    onChange={e => {
                      const id = e.target.value;
                      setWaTemplate(id);
                      if (id !== 'none') {
                        const tpl = waTemplates.find(t => t.id === id);
                        if (tpl) setWaMessage(waLang === 'zh' ? tpl.zh : tpl.en);
                      }
                    }}
                    style={{ padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#475569' }}
                  >
                    <option value="none">No template</option>
                    {waTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {waTemplate !== 'none' && (() => {
                    const tpl = waTemplates.find(t => t.id === waTemplate);
                    return tpl?.zh ? (
                      <div style={{ display: 'inline-flex', borderRadius: 5, background: '#f1f5f9', padding: 2 }}>
                        {(['en', 'zh'] as const).map(l => (
                          <button key={l} onClick={() => { setWaLang(l); if (tpl) setWaMessage(l === 'zh' ? tpl.zh : tpl.en); }} style={{
                            padding: '2px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', lineHeight: '15px',
                            border: 'none', background: waLang === l ? '#fff' : 'transparent',
                            color: waLang === l ? '#1e293b' : '#94a3b8',
                            boxShadow: waLang === l ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                          }}>{l === 'en' ? 'EN' : '中文'}</button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                <textarea
                  placeholder="Type your message..."
                  style={{
                    display: 'block', width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff',
                    height: 100, resize: 'vertical' as const, lineHeight: 1.5, color: '#1e293b', outline: 'none',
                  }}
                  value={waMessage} onChange={e => setWaMessage(e.target.value)}
                />
                {/\{\{.+?\}\}/.test(waMessage) && (
                  <span style={{ fontSize: 11, color: '#d97706', marginTop: 3, display: 'block', lineHeight: 1.4 }}>
                    Placeholders like {'{{childName}}'} won't be auto-filled here.
                  </span>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ padding: '16px 24px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setWhatsappModal(false)} style={{
                padding: '8px 16px', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
                cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
              }}>Cancel</button>
              <div style={{ flex: 1 }} />
              <button onClick={open} disabled={!valid} style={{
                padding: '9px 22px', background: valid ? '#22c55e' : '#e2e8f0', color: valid ? '#fff' : '#94a3b8',
                border: 'none', borderRadius: 8, cursor: valid ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: valid ? '0 1px 3px rgba(34,197,94,0.3)' : 'none',
              }}>
                <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 15 }} />
                Send via WhatsApp
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 9, opacity: 0.7, marginLeft: 1 }} />
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}

const modal: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  box: {
    background: '#fff', borderRadius: 14, padding: '24px 28px', width: 420, maxWidth: '90vw',
    display: 'flex', flexDirection: 'column', gap: 18,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  waIcon: {
    width: 36, height: 36, borderRadius: 10, background: '#25D366',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: { fontWeight: 700, fontSize: 16, color: '#0f172a', lineHeight: 1.3 },
  subtitle: { fontSize: 12, color: '#94a3b8', fontWeight: 400, lineHeight: 1.3 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#94a3b8', lineHeight: 1, padding: 4,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, fontFamily: 'inherit', color: '#1e293b', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  textarea: {
    padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, fontFamily: 'inherit', resize: 'vertical', color: '#1e293b',
    outline: 'none',
  },
  footer: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    paddingTop: 4,
  },
  cancelBtn: {
    padding: '8px 18px', background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b',
  },
  openBtn: {
    padding: '8px 18px', background: '#25D366', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  },
  openBtnDisabled: {
    padding: '8px 18px', background: '#e2e8f0', color: '#94a3b8', border: 'none',
    borderRadius: 8, cursor: 'not-allowed', fontSize: 13, fontWeight: 700,
  },
};

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    height: 50,
    background: '#5a79c8',
    color: '#fff',
    gap: 20,
    fontFamily: 'system-ui, sans-serif',
  },
  brand: {
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: '-0.3px',
    color: '#fff',
  },
  links: { display: 'flex', gap: 2, flex: 1, alignItems: 'center' },
  link: {
    color: 'rgba(255,255,255,0.75)',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
  },
  activeLink: {
    color: '#fff',
    background: 'rgba(255,255,255,0.18)',
    fontWeight: 600,
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
  // Unified panel style for all dropdowns
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
    minWidth: 190,
    zIndex: 100,
    border: '1px solid #e5e7eb',
    padding: '4px 0',
  },
  panelItem: {
    display: 'block',
    padding: '7px 14px',
    color: '#374151',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 400,
    whiteSpace: 'nowrap',
    background: 'none',
  },
  panelItemActive: {
    color: '#3c339a',
    fontWeight: 600,
    background: '#eef0fa',
  },
  right: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 28, height: 28, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  userName: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 },
  logoutBtn: {
    padding: '5px 12px',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
};
