import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { TP_C, TP_MOTION } from './tokens.js';
import { SearchBar, SearchBarHandle } from '../../components/common/SearchBar.js';

export type TeachersTabKey = 'active' | 'inactive' | 'all';

interface TeachersToolbarProps {
  tab: TeachersTabKey;
  onTabChange: (t: TeachersTabKey) => void;
  counts: { active: number; inactive: number; all: number };
  search: string;
  onSearchChange: (s: string) => void;
  rightActions?: React.ReactNode;
}

export function TeachersToolbar({
  tab, onTabChange, counts, search, onSearchChange, rightActions,
}: TeachersToolbarProps) {
  const searchRef = useRef<SearchBarHandle>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const tabs: Array<{ key: TeachersTabKey; label: string; count: number }> = [
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'inactive', label: 'Inactive', count: counts.inactive },
    { key: 'all', label: 'All teachers', count: counts.all },
  ];

  return (
    <>
    <style>{selectCss}</style>
    <div style={styles.toolbar}>
      <div style={{ width: 320 }}>
        <SearchBar
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search by name..."
        />
      </div>

      <div style={styles.rightGroup}>
        <div style={styles.selectWrap}>
          <select
            className="tp-filter-select"
            value={tab}
            onChange={e => onTabChange(e.target.value as TeachersTabKey)}
            style={styles.select}
          >
            {tabs.map(t => (
              <option key={t.key} value={t.key}>
                {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
              </option>
            ))}
          </select>
          <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: TP_C.muted, pointerEvents: 'none', position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }} />
        </div>
        {rightActions}
      </div>
    </div>
    </>
  );
}

const selectCss = `
  .tp-filter-select,
  .tp-filter-select:hover,
  .tp-filter-select:focus {
    border: 1px solid #eef0f4 !important;
    outline: none !important;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02) !important;
  }
  .tp-filter-select:hover {
    border-color: #d4d8de !important;
  }
`;

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  selectWrap: {
    position: 'relative' as const,
    display: 'inline-flex',
    alignItems: 'center',
  },
  select: {
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    MozAppearance: 'none' as const,
    padding: '10px 34px 10px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: TP_C.text,
    background: TP_C.card,
    border: `1px solid ${TP_C.borderSoft}`,
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 140,
    transition: `border-color ${TP_MOTION.fast}`,
  },
};
