import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { uploadUrl } from '../../api/upload.js';
import MyAvatar from '../../components/common/MyAvatar.js';

// Teacher Home → the identity card. Their photo inside a progress ring (how
// close they are to the next rank, like an activity ring), their rank badge
// worn on its bottom-right corner like a medal, then three short lines: name,
// rank (+ level stars), and where they're heading. Not a link — just them.

const RING = 64;
const STROKE = 4;
const AVATAR = RING - STROKE * 2 - 4;
/** The rank badge, worn on the photo — its own shape (a shield), no plate behind it. */
const BADGE = 26;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const C = { text: '#1e293b', muted: '#64748b', soft: '#94a3b8', accent: '#7c3aed', deep: '#5b21b6', track: '#ede9fe', card: '#fff', border: '#ede9fe' };

export interface HeroProgress {
  /** 0–100 toward the next rank. */
  pct: number;
  /** "0% to Junior EI", "Ready for what's next", "Top role reached". */
  label: string;
}

interface Props {
  name: string;
  /** Their own Home — show their profile photo (others see the initial). */
  ownPhoto: boolean;
  avatarColor: string;
  role: string | null;
  stars: number;
  badgeUrl: string | null;
  progress: HeroProgress | null;
}

export default function IdentityHero({ name, ownPhoto, avatarColor, role, stars, badgeUrl, progress }: Props) {
  const look: React.CSSProperties = { background: avatarColor, color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.01em' };
  const pct = Math.max(0, Math.min(100, progress?.pct ?? 0));
  return (
    <section aria-label={`${name || 'You'}${role ? `, ${role}` : ''}${progress ? `, ${progress.label}` : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, width: '100%', boxSizing: 'border-box', textAlign: 'left', color: 'inherit',
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '14px 16px', marginBottom: 12,
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}>
      {/* Photo in its progress ring, the rank badge worn on its corner like a medal. */}
      <span style={{ position: 'relative', width: RING, height: RING, flexShrink: 0 }}>
        <svg width={RING} height={RING} aria-hidden style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor={C.accent} />
            </linearGradient>
          </defs>
          <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={C.track} strokeWidth={STROKE} />
          {progress && pct > 0 && (
            <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="url(#hero-ring)" strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)} />
          )}
        </svg>
        <span style={{ position: 'absolute', top: (RING - AVATAR) / 2, left: (RING - AVATAR) / 2 }}>
          {ownPhoto
            ? <MyAvatar name={name || '?'} size={AVATAR} style={look} />
            : <span style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...look }}>{(name || '?').charAt(0).toUpperCase()}</span>}
        </span>
        {badgeUrl && (
          // Just the shield — transparent, no plate, edge or shadow.
          <img src={uploadUrl(badgeUrl)} alt={role ? `${role} badge` : 'Position badge'} title={role ? `${role} badge` : undefined} style={{
            position: 'absolute', right: -6, bottom: -4, width: BADGE, height: BADGE, objectFit: 'contain', display: 'block',
          }} />
        )}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name || 'Welcome back'}
        </span>
        {role && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 13, fontWeight: 700, color: C.muted }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</span>
            {stars > 0 && (
              <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }} title={`${stars}-star ${role}`}>
                {Array.from({ length: stars }, (_, i) => <FontAwesomeIcon key={i} icon={faStar} style={{ fontSize: 10, color: C.accent }} />)}
              </span>
            )}
          </span>
        )}
        {progress && (
          <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, fontWeight: 700, color: C.deep, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {progress.label}
          </span>
        )}
      </span>
    </section>
  );
}
