import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faIdCard } from '@fortawesome/free-solid-svg-icons';
import { fetchStaffJoins } from '../../api/staffJoins.js';
import { TP_C, TP_RADIUS } from './tokens.js';

// Staff page: "2 new staff waiting for approval — Review". Only shown when
// someone sent the New staff form and HR hasn't approved or rejected them
// yet; the queue itself lives on HR → New Staff (same cache key).
export function PendingJoinersNotice() {
  const { data: requests = [] } = useQuery({ queryKey: ['staff-joins'], queryFn: fetchStaffJoins, retry: false });
  const waiting = requests.filter(r => r.status === 'PENDING').length;
  if (waiting === 0) return null;

  return (
    <Link to="/hr/new-staff" className="tp-joiners-notice" style={s.notice}>
      <span style={s.icon}><FontAwesomeIcon icon={faIdCard} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{waiting} new staff</strong> waiting for approval
      </span>
      <span style={s.review}>Review <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} /></span>
    </Link>
  );
}

const s = {
  notice: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '10px 14px', marginBottom: 14, borderRadius: TP_RADIUS.card,
    background: TP_C.amberBg, border: '1px solid #fde68a', color: '#92400e',
    fontSize: 13, textDecoration: 'none',
  } as React.CSSProperties,
  icon: {
    width: 28, height: 28, borderRadius: TP_RADIUS.control, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fef3c7', color: TP_C.amber,
  } as React.CSSProperties,
  review: { display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: TP_C.amber } as React.CSSProperties,
};
