import { forwardRef, useImperativeHandle, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

export interface SearchBarHandle {
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Optional keyboard shortcut label, e.g. "⌘K". Hidden while the user is typing. */
  kbdHint?: string;
  /** Fixed width; omit for 100% of the parent. */
  width?: number | string;
  autoFocus?: boolean;
}

export const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(function SearchBar(
  { value, onChange, placeholder = 'Search...', kbdHint, width, autoFocus },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => onChange(''),
  }), [onChange]);

  return (
    <>
      <style>{searchCss}</style>
      <div className="sb-wrap" style={{ ...styles.wrap, width: width ?? '100%' }}>
        <FontAwesomeIcon icon={faSearch} style={{ fontSize: 13, color: '#94a3b8', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          className="sb-input"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={styles.input}
        />
        {kbdHint && !value && <kbd style={styles.kbd}>{kbdHint}</kbd>}
      </div>
    </>
  );
});

const searchCss = `
  .sb-wrap {
    transition: border-color 120ms ease;
  }
  .sb-wrap:hover {
    border-color: #d4d8de !important;
  }
  /* Defeat the global input reset that forces a border on every <input>. */
  .sb-wrap input.sb-input,
  .sb-wrap input.sb-input:hover,
  .sb-wrap input.sb-input:focus {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
  }
  .sb-wrap input.sb-input:focus::placeholder {
    color: inherit !important;
  }
`;

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 16px',
    background: '#ffffff',
    border: '1px solid #eef0f4',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02)',
    boxSizing: 'border-box' as const,
  },
  input: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    color: '#0f172a',
    background: 'transparent',
    flex: 1,
    minWidth: 0,
    fontFamily: 'inherit',
  },
  kbd: {
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    background: '#f1f5f9',
    border: '1px solid #eef0f4',
    borderRadius: 5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
};
