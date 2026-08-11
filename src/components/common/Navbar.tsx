import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../api/settings.js';
import { fetchCandidateFormOptions } from '../../api/candidates.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faArrowUpRightFromSquare, faUsers, faGraduationCap, faBoxesStacked, faMessage, faPlug, faFileImport, faBars, faClipboardList, faCalendarDays, faUserPlus, faBullhorn, faChartLine, faCoins, faLink, faCopy, faCircleCheck, faMoneyBillTrendUp, faReceipt, faChartPie, faGift, faTrash, faChalkboardUser, faSliders, faScrewdriverWrench, faUserShield, faChildren, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

/** Normalises a human-readable label into a URL-safe utm_source value.
 *  "Facebook Ads" → "facebook_ads", "小红书" → "小红书" (kept as-is),
 *  spaces / punctuation collapsed to underscores. */
function toApplyUtmSlug(label: string): string {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function Navbar() {
  const { isMobile, isTablet } = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { name: string; role: string }) : null;
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [whatsappModal, setWhatsappModal] = useState(false);
  const [shareLinksModal, setShareLinksModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState('');
  const [applyLinksModal, setApplyLinksModal] = useState(false);
  const [copiedApplyLink, setCopiedApplyLink] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waTemplate, setWaTemplate] = useState('none');
  const [waLang, setWaLang] = useState<'en' | 'zh'>('zh');
  const analysisRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const studentsRef = useRef<HTMLDivElement>(null);
  const hrRef = useRef<HTMLDivElement>(null);
  const financeRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const devRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);
  const onFinanceRoute = !!useMatch('/operations/operating-costs');
  const onToolsRoute = !!useMatch('/tools/*');
  // Both useMatch calls must run every render, unconditionally — `||`
  // short-circuits, which would skip the second call whenever the first
  // matches, changing the number of hooks called between renders and
  // crashing React's hook-order check on the next navigation.
  const usersSettingsMatch = useMatch('/settings/users');
  const adminWildcardMatch = useMatch('/admin/*');
  const onAdminRoute = !!(usersSettingsMatch || adminWildcardMatch);
  const onDevRoute = !!useMatch('/settings/test/*');
  const onAnalysisRoute = !!useMatch('/analysis/*');
  const onSettingsRoute = !!useMatch('/settings/*') && !onAdminRoute && !onDevRoute;
  const studentsMatch = useMatch('/students');
  const onboardingMatch = useMatch('/onboarding');
  const onStudentsRoute = !!(studentsMatch || onboardingMatch);
  const teachersRouteMatch = useMatch('/teachers/*');
  const hrRouteMatch = useMatch('/hr/*');
  const onHrRoute = !!(teachersRouteMatch || hrRouteMatch);

  // Templates for WhatsApp modal
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  // Referral sources for the Apply Form Links modal — same public
  // endpoint + cache key the Candidates page and apply form both use,
  // so this list can never drift from what applicants actually see.
  const { data: candidateFormOptions } = useQuery({
    queryKey: ['candidate-form-options'],
    queryFn: fetchCandidateFormOptions,
  });
  const applyReferralSources = (candidateFormOptions?.referralSources ?? [])
    .filter(s => s.toLowerCase() !== 'other');
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
      if (hrRef.current && !hrRef.current.contains(e.target as Node)) setHrOpen(false);
      if (financeRef.current && !financeRef.current.contains(e.target as Node)) setFinanceOpen(false);
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
      if (devRef.current && !devRef.current.contains(e.target as Node)) setDevOpen(false);
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminOpen(false);
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

  const closeAll = () => { setMobileMenuOpen(false); setAnalysisOpen(false); setSettingsOpen(false); setStudentsOpen(false); setHrOpen(false); setFinanceOpen(false); setToolsOpen(false); setDevOpen(false); setAdminOpen(false); };

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

    // One icon-before-label helper instead of repeating the same style
    // object at all nine top-level triggers.
    const navIcon = (icon: any) => <FontAwesomeIcon icon={icon} style={{ fontSize: 13, marginRight: 7, opacity: 0.9 }} />;

    return (
      <>
        {/* Leads link */}
        <NavLink to="/leads" end onClick={closeAll}
          className={mobile ? '' : 'nav-link'}
          style={({ isActive }) => mobile
            ? { ...mLink, ...(isActive ? mLinkActive : {}) }
            : { ...styles.link, ...(isActive ? styles.activeLink : {}) }
          }>{navIcon(faBullhorn)}Leads</NavLink>

        {/* Students dropdown */}
        <div ref={mobile ? undefined : studentsRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setStudentsOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onStudentsRoute && !mobile ? styles.activeLink : {}), ...(onStudentsRoute && mobile ? mLinkActive : {}) }}>
            {/* Icon+label grouped in their own span — the button's own
                flex (space-between on mobile) is what pushes the +/−/▾
                suffix to the far edge, and a 3rd top-level flex child
                would get spread apart by that same rule. */}
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{navIcon(faGraduationCap)}Students</span>
            {mobile ? (studentsOpen ? '−' : '+') : '▾'}
          </button>
          {studentsOpen && (
            <div style={mPanel}>
              <NavLink to="/students" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faUsers} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                All Students
              </NavLink>
              <NavLink to="/onboarding" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Onboarding
              </NavLink>
            </div>
          )}
        </div>

        {/* HR dropdown — Teachers + Candidates grouped under one people-ops
            umbrella (matches the app's documented IA: HR = people-ops
            workflows, already the route prefix for /hr/candidates). Used
            to be two flat top-level items with no shared home. */}
        <div ref={mobile ? undefined : hrRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setHrOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onHrRoute && !mobile ? styles.activeLink : {}), ...(onHrRoute && mobile ? mLinkActive : {}) }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{navIcon(faUsers)}HR</span>
            {mobile ? (hrOpen ? '−' : '+') : '▾'}
          </button>
          {hrOpen && (
            <div style={mPanel}>
              <NavLink to="/teachers" end onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faChalkboardUser} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Staff
              </NavLink>
              <NavLink to="/hr/candidates" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faUserPlus} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Recruitment
              </NavLink>
            </div>
          )}
        </div>

        {/* Finance dropdown — grouped with the people-pipeline cluster
            (Leads/Students/HR) rather than Analysis: it's a workflow
            surface (operating costs), not a report. */}
        <div ref={mobile ? undefined : financeRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setFinanceOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onFinanceRoute && !mobile ? styles.activeLink : {}) }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{navIcon(faMoneyBillTrendUp)}Finance</span>
            {mobile ? (financeOpen ? '−' : '+') : '▾'}
          </button>
          {financeOpen && (
            <div style={mPanel}>
              <NavLink to="/operations/operating-costs" className={mobile ? '' : 'nav-drop-item'}
                style={{ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={closeAll}>
                <FontAwesomeIcon icon={faReceipt} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Operating Costs
              </NavLink>
            </div>
          )}
        </div>

        {/* Groups the nav into three clusters: people pipeline (Leads →
            Finance), insights (Analysis, Operations), and config/admin
            (Tools → Admin) — was previously nine items with no visual
            grouping at all. */}
        {!mobile && <div style={styles.groupDivider} />}

        {/* Analysis dropdown */}
        <div ref={mobile ? undefined : analysisRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setAnalysisOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onAnalysisRoute && !mobile ? styles.activeLink : {}), ...(onAnalysisRoute && mobile ? mLinkActive : {}) }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{navIcon(faChartLine)}Analysis</span>
            {mobile ? (analysisOpen ? '−' : '+') : '▾'}
          </button>
          {analysisOpen && (
            <div style={mPanel}>
              <NavLink to="/analysis/sales-marketing" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faBullhorn} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Marketing
              </NavLink>
              <NavLink to="/analysis/sales" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Sales
              </NavLink>
              <NavLink to="/analysis/revenue" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faCoins} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Revenue
              </NavLink>
              <NavLink to="/analysis/employee-cost" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faUsers} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Staff
              </NavLink>
              <NavLink to="/analysis/operating-cost" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faReceipt} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Operating Cost
              </NavLink>
              <NavLink to="/analysis/finance" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faMoneyBillTrendUp} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Finance
              </NavLink>
              <NavLink to="/analysis/profit-sharing" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faChartPie} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Profit Sharing
              </NavLink>
              <NavLink to="/analysis/annual-bonus" onClick={closeAll}
                className={mobile ? '' : 'nav-drop-item'}
                style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                <FontAwesomeIcon icon={faGift} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                Annual Bonus
              </NavLink>
            </div>
          )}
        </div>

        {!mobile && <div style={styles.groupDivider} />}

        {/* Tools dropdown */}
        <div ref={mobile ? undefined : toolsRef} style={mobile ? {} : { position: 'relative' }}>
          <button onClick={() => setToolsOpen(o => !o)} className={mobile ? '' : 'nav-link'}
            style={{ ...mDropBtn, ...(onToolsRoute && !mobile ? styles.activeLink : {}) }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>{navIcon(faScrewdriverWrench)}Tools</span>
            {mobile ? (toolsOpen ? '−' : '+') : '▾'}
          </button>
          {toolsOpen && (() => {
            // Divider pattern borrowed from the Settings dropdown, but section
            // headers drop the icon: with only a handful of shallow groups here
            // (vs. Settings' 10-group mega-menu) a second icon per row next to the
            // item's own icon reads as noise rather than a scanning aid, and
            // it forced a 4px text-alignment mismatch between header and item
            // labels (14px icon+8px gap vs 16px icon+10px gap). Plain
            // uppercase labels align cleanly with the item rail below them.
            const sep = <div style={{ height: 1, background: '#f0f0f0', margin: '6px 8px' }} />;
            const section = (label: string, first?: boolean) => (
              <div style={{ padding: mobile ? `${first ? 8 : 10}px 20px 6px` : `${first ? 8 : 10}px 14px 6px`, fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
                {label}
              </div>
            );
            const item = (icon: any, iconColor: string, label: string, onClick: () => void) => (
              <button
                key={label}
                className={mobile ? '' : 'nav-drop-item'}
                style={{ ...mPanelItem, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' as const, background: 'none', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={onClick}>
                <FontAwesomeIcon icon={icon} style={{ fontSize: 12, color: iconColor, width: 16 }} />
                {label}
              </button>
            );
            return (
              <div style={mPanel}>
                {section('Planning', true)}
                <NavLink to="/tools/operations-planner" className={mobile ? '' : 'nav-drop-item'}
                  style={{ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}
                  onClick={closeAll}>
                  <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                  Planner
                </NavLink>
                {sep}
                {section('Messaging')}
                {item(faWhatsapp, '#25D366', 'WhatsApp', () => { closeAll(); setWaPhone(''); setWaMessage(''); setWaTemplate('none'); setWaLang('zh'); setWhatsappModal(true); })}
                {sep}
                {section('Enquiry')}
                {item(faArrowUpRightFromSquare, '#94a3b8', 'Enquiry Form', () => { closeAll(); window.open('/enquiry', '_blank'); })}
                {item(faLink, '#94a3b8', 'Enquiry Links', () => { closeAll(); setShareLinksModal(true); })}
                {sep}
                {section('Candidates')}
                {item(faArrowUpRightFromSquare, '#94a3b8', 'Apply Form', () => { closeAll(); window.open('/apply', '_blank'); })}
                {item(faLink, '#94a3b8', 'Apply Links', () => { closeAll(); setApplyLinksModal(true); })}
              </div>
            );
          })()}
        </div>

        {/* Settings dropdown — admin only */}
        {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
          <div ref={mobile ? undefined : settingsRef} style={mobile ? {} : { position: 'relative' }}>
            <button onClick={() => setSettingsOpen(o => !o)} className={mobile ? '' : 'nav-link'}
              style={{ ...mDropBtn, ...(onSettingsRoute && !mobile ? styles.activeLink : {}), ...(onSettingsRoute && mobile ? mLinkActive : {}) }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{navIcon(faSliders)}Settings</span>
              {mobile ? (settingsOpen ? '−' : '+') : '▾'}
            </button>
            {settingsOpen && (
              <div style={mPanel}>
                {[
                  { to: '/settings/company', icon: faBuilding, label: 'Company' },
                  { to: '/settings/leads', icon: faUsers, label: 'CRM' },
                  { to: '/settings/onboarding', icon: faGraduationCap, label: 'Students' },
                  { to: '/settings/packages', icon: faBoxesStacked, label: 'Packages & Pricing' },
                  { to: '/settings/timetable/classes', icon: faCalendarDays, label: 'Timetable' },
                  {
                    to: '/settings/hr', icon: faCoins, label: 'HR & Payroll',
                    subItems: [
                      { to: '/settings/recruitment', label: 'Recruitment' },
                      { to: '/settings/hr', label: 'Payroll' },
                    ],
                  },
                  { to: '/settings/operating-cost', icon: faReceipt, label: 'Operating Cost' },
                  { to: '/settings/finance', icon: faMoneyBillTrendUp, label: 'Finance' },
                  { to: '/settings/whatsapp-templates', icon: faMessage, label: 'Communication' },
                  { to: '/settings/calendar', icon: faPlug, label: 'Integrations' },
                  { to: '/settings/data', icon: faFileImport, label: 'Data' },
                ].map(it => (
                  <div key={it.to}>
                    <NavLink to={it.to} onClick={closeAll}
                      className={mobile ? '' : 'nav-drop-item'}
                      style={({ isActive }) => ({ ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>
                      <FontAwesomeIcon icon={it.icon} style={{ fontSize: 12, color: '#94a3b8', width: 16 }} />
                      {it.label}
                    </NavLink>
                    {it.subItems?.map(sub => (
                      <NavLink key={sub.to} to={sub.to} onClick={closeAll}
                        className={mobile ? '' : 'nav-drop-item'}
                        style={{
                          ...mPanelItem, textDecoration: 'none', display: 'flex', alignItems: 'center',
                          paddingLeft: mobile ? 46 : 40, fontSize: 12.5, color: '#6b7280',
                        }}>
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin dropdown — ADMIN+ only */}
        {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
          <div ref={mobile ? undefined : adminRef} style={mobile ? {} : { position: 'relative' }}>
            <button onClick={() => setAdminOpen(o => !o)} className={mobile ? '' : 'nav-link'}
              style={{ ...mDropBtn, ...(onAdminRoute && !mobile ? styles.activeLink : {}), ...(onAdminRoute && mobile ? mLinkActive : {}) }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{navIcon(faUserShield)}Admin</span>
              {mobile ? (adminOpen ? '−' : '+') : '▾'}
            </button>
            {adminOpen && (
              <div style={mobile ? { ...mPanel } : { position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', minWidth: 200, zIndex: 100, padding: '6px', border: '1px solid #e8eaed' }}>
                <NavLink to="/settings/users" onClick={closeAll}
                  className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 8, padding: mobile ? '10px 20px' : '9px 14px', fontSize: 13, textDecoration: 'none',
                    color: isActive ? '#3c339a' : '#374151', fontWeight: isActive ? 600 : 500,
                    background: isActive ? '#eef0fa' : 'none', borderRadius: 6,
                  })}>
                  <FontAwesomeIcon icon={faUserPlus} style={{ fontSize: 12, color: '#94a3b8' }} /> Manage Users
                </NavLink>
                <NavLink to="/admin/year-rollover" onClick={closeAll}
                  className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 8, padding: mobile ? '10px 20px' : '9px 14px', fontSize: 13, textDecoration: 'none',
                    color: isActive ? '#3c339a' : '#374151', fontWeight: isActive ? 600 : 500,
                    background: isActive ? '#eef0fa' : 'none', borderRadius: 6,
                  })}>
                  <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 12, color: '#94a3b8' }} /> Year Rollover
                </NavLink>
                {/* Destructive — coloured red so it doesn't blend in
                    with the safe admin actions above. Route is
                    role-gated at the wrapper (only ADMIN / SUPERADMIN
                    render this whole dropdown), and the backend
                    /api/candidates/reset-all endpoint also enforces
                    adminMiddleware — belt + braces. */}
                <NavLink to="/settings/test/reset-candidates" onClick={closeAll}
                  className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 8, padding: mobile ? '10px 20px' : '9px 14px', fontSize: 13, textDecoration: 'none',
                    color: isActive ? '#9b1c1c' : '#c53030', fontWeight: isActive ? 700 : 600,
                    background: isActive ? '#fef2f2' : 'none', borderRadius: 6,
                  })}>
                  <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12, color: '#c53030' }} /> Reset All Candidates
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* Dev tools — SUPERADMIN only */}
        {user?.role === 'SUPERADMIN' && (
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
                <NavLink to="/settings/test/seed-candidates" onClick={closeAll}
                  className={mobile ? '' : 'nav-drop-item'}
                  style={({ isActive }) => ({ ...mPanelItem, ...(isActive ? (mobile ? mLinkActive : styles.panelItemActive) : {}) })}>Seed Dummy Candidates</NavLink>
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
      .nav-drop-item { border-radius: 6px !important; transition: background 0.1s ease; }
      .nav-drop-item:hover { background: #f1f5f9 !important; }
      .nav-link { transition: all 0.15s ease; }
      .nav-link:hover { color: #fff !important; background: rgba(255,255,255,0.12); }
    `}</style>
    <nav style={{ ...styles.nav, padding: isTablet ? '0 12px' : '0 24px' }}>
      {/* ── Mobile/Tablet: hamburger on left ── */}
      {isTablet && (
        <button onClick={() => setMobileMenuOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '4px 8px', marginRight: 8 }}>
          <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} />
        </button>
      )}

      <span style={styles.brand}>
        <span style={styles.brandMark}><FontAwesomeIcon icon={faChildren} style={{ fontSize: 13 }} /></span>
        KinderTech
      </span>

      {/* ── Desktop nav ── */}
      {!isTablet && (
        <>
          <div style={styles.divider} />
          <div style={styles.links}>{renderNavItems(false)}</div>
          <div style={styles.right}>
            {user && (
              <div style={styles.profileChip}>
                <div style={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div>
                <span style={styles.userName}>{user.name}</span>
              </div>
            )}
            <div style={styles.divider} />
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
                </div>
                <textarea
                  placeholder="Type your message..."
                  style={{
                    display: 'block', width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
                    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff',
                    height: 200, resize: 'vertical' as const, lineHeight: 1.5, color: '#1e293b', outline: 'none',
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
                Open in WhatsApp
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 9, opacity: 0.7, marginLeft: 1 }} />
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Share Links Modal */}
    {shareLinksModal && (
      <div style={modal.overlay}>
        <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.16)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Enquiry Form Links</h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Click to copy. Use for QR codes, ads, or social posts.</div>
            </div>
            <button onClick={() => setShareLinksModal(false)} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#cbd5e1', padding: '4px 2px', lineHeight: 1 }}><FontAwesomeIcon icon={faXmark} /></button>
          </div>
          {/* Links */}
          <div style={{ padding: '8px 10px', maxHeight: 400, overflowY: 'auto' }}>
            {[
              { label: 'QR School Door', desc: 'Parents walking past', utm: 'door-qr', emoji: '🏫' },
              { label: 'QR Flyer / Banner', desc: 'Printed materials', utm: 'flyer-qr', emoji: '📄' },
              { label: 'Facebook', desc: 'Facebook posts & ads', utm: 'facebook', emoji: '📘' },
              { label: 'Instagram', desc: 'Instagram bio & stories', utm: 'instagram', emoji: '📷' },
              { label: 'Google', desc: 'Google Ads', utm: 'google', emoji: '🔍' },
              { label: '小红书 Xiaohongshu', desc: 'REDnote posts', utm: 'xiaohongshu', emoji: '📕' },
              { label: 'WhatsApp', desc: 'Shared via WhatsApp', utm: 'whatsapp', emoji: '💬' },
              { label: 'Direct Link', desc: 'No tracking', utm: '', emoji: '🔗' },
            ].map(item => {
              const baseUrl = window.location.origin;
              const url = item.utm ? `${baseUrl}/enquiry?utm_source=${item.utm}` : `${baseUrl}/enquiry`;
              const isCopied = copiedLink === (item.utm || '_direct');
              return (
                <div key={item.utm || '_direct'}
                  onClick={() => { navigator.clipboard.writeText(url); setCopiedLink(item.utm || '_direct'); setTimeout(() => setCopiedLink(''), 2000); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 10, cursor: 'pointer',
                    background: isCopied ? '#f0fdf4' : 'transparent', border: isCopied ? '1px solid #bbf7d0' : '1px solid transparent',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!isCopied) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isCopied) (e.currentTarget as HTMLElement).style.background = isCopied ? '#f0fdf4' : 'transparent'; }}
                >
                  <span style={{ fontSize: 18, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 8, flexShrink: 0 }}>{item.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 11, color: isCopied ? '#16a34a' : '#cbd5e1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isCopied ? <><FontAwesomeIcon icon={faCircleCheck} /> Copied</> : <FontAwesomeIcon icon={faCopy} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* Apply Form Links Modal — same shape as Share Links, but the
        channel list is the admin-curated recruitment referral sources
        instead of a fixed set, since that's what already drives the
        equivalent picker on the Candidates page. */}
    {applyLinksModal && (
      <div style={modal.overlay}>
        <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.16)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Apply Form Links</h3>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Click to copy. Use for QR codes, ads, or social posts.</div>
            </div>
            <button onClick={() => setApplyLinksModal(false)} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#cbd5e1', padding: '4px 2px', lineHeight: 1 }}><FontAwesomeIcon icon={faXmark} /></button>
          </div>
          {/* Links */}
          <div style={{ padding: '8px 10px', maxHeight: 400, overflowY: 'auto' }}>
            {[
              { label: 'Direct Link', desc: 'No tracking', utm: '' },
              ...applyReferralSources.map(label => ({ label, desc: 'Tracked to this source', utm: toApplyUtmSlug(label) })),
            ].map(item => {
              const baseUrl = window.location.origin;
              const url = item.utm ? `${baseUrl}/apply?utm_source=${encodeURIComponent(item.utm)}` : `${baseUrl}/apply`;
              const isCopied = copiedApplyLink === (item.utm || '_direct');
              return (
                <div key={item.utm || '_direct'}
                  onClick={() => { navigator.clipboard.writeText(url); setCopiedApplyLink(item.utm || '_direct'); setTimeout(() => setCopiedApplyLink(''), 2000); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 10, cursor: 'pointer',
                    background: isCopied ? '#f0fdf4' : 'transparent', border: isCopied ? '1px solid #bbf7d0' : '1px solid transparent',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!isCopied) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isCopied) (e.currentTarget as HTMLElement).style.background = isCopied ? '#f0fdf4' : 'transparent'; }}
                >
                  <span style={{ fontSize: 18, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 8, flexShrink: 0 }}>
                    <FontAwesomeIcon icon={faLink} style={{ fontSize: 13, color: '#94a3b8' }} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 11, color: isCopied ? '#16a34a' : '#cbd5e1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isCopied ? <><FontAwesomeIcon icon={faCircleCheck} /> Copied</> : <FontAwesomeIcon icon={faCopy} />}
                  </div>
                </div>
              );
            })}
            {applyReferralSources.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 11, color: '#94a3b8' }}>
                Add sources in Settings → Recruitment to get tracked links per channel.
              </div>
            )}
          </div>
        </div>
      </div>
    )}
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
    // A flat color block sitting flush against the page reads as part of
    // the content rather than a fixed chrome layer. A hairline shadow is
    // enough to give it elevation without a heavy border.
    boxShadow: '0 1px 3px rgba(15,23,42,0.12)',
    position: 'relative',
    zIndex: 50,
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 9,
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: '-0.3px',
    color: '#fff',
    flexShrink: 0,
  },
  brandMark: {
    width: 26, height: 26, borderRadius: 8,
    background: 'rgba(255,255,255,0.16)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  // NOT overflow-x:auto here, tempting as it looks for the narrow-window
  // case — setting only the x-axis makes the y-axis compute to auto too
  // (CSS overflow spec), and every dropdown panel is an absolutely
  // positioned descendant of this row that extends below it. That turned
  // this into a clipping container and silently hid every dropdown menu
  // in the app. flexShrink:0 on `right` (profile+Logout) is the actual
  // fix for narrow windows; this row is just allowed to overflow visibly.
  links: { display: 'flex', gap: 3, flex: 1, alignItems: 'center' },
  link: {
    color: 'rgba(255,255,255,0.75)',
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    // Without this, flex-shrink squeezes labels down to whatever fits —
    // "Settings" clipping mid-word into "Settir" — instead of the row
    // just scrolling past whichever items don't fit.
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
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
    top: 'calc(100% + 8px)',
    left: 0,
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    minWidth: 200,
    zIndex: 100,
    border: '1px solid #e8eaed',
    padding: '6px',
  },
  panelItem: {
    display: 'block',
    padding: '9px 14px',
    color: '#374151',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    background: 'none',
    borderRadius: 6,
  },
  panelItemActive: {
    color: '#3c339a',
    fontWeight: 600,
    background: '#eef0fa',
  },
  // One divider style reused in both spots (brand↔links, profile↔logout) —
  // they'd drifted to different heights (22 vs 18) despite reading as the
  // same visual element.
  divider: { width: 1, height: 20, background: 'rgba(255,255,255,0.2)', flexShrink: 0 },
  // Lighter/shorter than `divider` — marks a sub-grouping within the nav
  // links themselves (people pipeline / insights / config) rather than a
  // major section break like brand↔links.
  groupDivider: { width: 1, height: 14, background: 'rgba(255,255,255,0.16)', flexShrink: 0, margin: '0 2px' },
  right: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  // Wrapped in the same pill treatment as Logout right next to it — before,
  // Logout was a bordered button while the avatar+name sat bare, an
  // inconsistent visual weight for two adjacent "identity" controls.
  profileChip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 10px 4px 4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  avatar: {
    width: 26, height: 26, borderRadius: '50%',
    background: 'rgba(255,255,255,0.22)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  userName: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 500 },
  logoutBtn: {
    padding: '5px 14px',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
};
