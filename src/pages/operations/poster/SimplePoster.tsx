import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { SopTemplate } from '../../../api/sop-templates.js';
import { resolveSopIcon } from '../../../utils/sopTemplateIcons.js';
import { useGuideImageUrl } from '../guidePhotos/StepPhoto.js';
import type { PosterPage, PosterStep } from './posterLayout.js';
import { POSTER_C, sheetStyle } from './posterSheet.js';

// The simple poster — the guide's steps laid out by the app (no AI): numbered
// tiles with each step's photo and title, grouped by section, with a QR code
// to the full guide. Shown until a guide author saves an AI poster.

const TITLE_PT: Record<number, number> = { 2: 17, 3: 13.5, 4: 11.5 };
const ACCENT = '#4338ca';

export function SimplePosterSheet({ template, page, pageNo, pageCount, qr, style }: {
  template: SopTemplate; page: PosterPage; pageNo: number; pageCount: number; qr: string | null; style?: React.CSSProperties;
}) {
  const updated = new Date(template.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="poster-sheet" aria-label={`Poster page ${pageNo} of ${pageCount}`} style={{ ...sheetStyle, padding: '12mm', display: 'flex', flexDirection: 'column', ...style }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '5mm', paddingBottom: '4mm', borderBottom: `0.4mm solid ${POSTER_C.border}` }}>
        <div style={s.icon}><FontAwesomeIcon icon={resolveSopIcon(template.icon)} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: '24pt', fontWeight: 800, color: POSTER_C.text, lineHeight: 1.15 }}>{template.title}</h1>
          {template.goal && <p style={{ margin: '1.5mm 0 0', fontSize: '10.5pt', color: POSTER_C.sub, lineHeight: 1.35 }}>{template.goal}</p>}
        </div>
        {qr && (
          <figure style={{ margin: 0, textAlign: 'center', flexShrink: 0 }}>
            <img src={qr} alt="QR code to the full guide" style={{ width: '24mm', height: '24mm', display: 'block' }} />
            <figcaption style={{ fontSize: '7pt', color: POSTER_C.muted, marginTop: '1mm' }}>Full guide</figcaption>
          </figure>
        )}
      </header>

      <div style={{ flex: 1, minHeight: 0, paddingTop: '4mm' }}>
        {page.groups.map((g, i) => (
          <div key={i} style={{ marginBottom: '4mm' }}>
            {g.section && (
              <h2 style={{ margin: '0 0 2.5mm', fontSize: '11pt', fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {g.section}{g.continued && <span style={{ fontWeight: 600, color: POSTER_C.muted, textTransform: 'none', letterSpacing: 0 }}> (continued)</span>}
              </h2>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${page.columns}, minmax(0, 1fr))`, gap: '4mm' }}>
              {g.steps.map(st => <PosterTile key={st.id} step={st} columns={page.columns} />)}
            </div>
          </div>
        ))}
      </div>

      <footer style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: POSTER_C.muted, paddingTop: '3mm', borderTop: `0.4mm solid ${POSTER_C.border}` }}>
        <span>Version {template.currentVersion} · Updated {updated}</span>
        {pageCount > 1 && <span>Page {pageNo} of {pageCount}</span>}
      </footer>
    </section>
  );
}

function PosterTile({ step, columns }: { step: PosterStep; columns: number }) {
  return (
    <article style={{ border: `0.4mm solid ${POSTER_C.border}`, borderRadius: '3mm', overflow: 'hidden', background: '#fff', breakInside: 'avoid' }}>
      {step.imageId && <TilePhoto imageId={step.imageId} alt={step.title} />}
      <div style={{ display: 'flex', gap: '2.5mm', alignItems: 'flex-start', padding: '2.5mm 3mm 3mm' }}>
        <span style={s.number}>{step.number}</span>
        <span style={{
          fontSize: `${TITLE_PT[columns]}pt`, fontWeight: 700, color: POSTER_C.text, lineHeight: 1.25, paddingTop: '0.6mm',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{step.title}</span>
      </div>
    </article>
  );
}

function TilePhoto({ imageId, alt }: { imageId: string; alt: string }) {
  const { url } = useGuideImageUrl(imageId, alt);
  return (
    <div style={{ aspectRatio: '4 / 3', background: POSTER_C.bg }}>
      {url && <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  icon: {
    width: '14mm', height: '14mm', borderRadius: '3.5mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#eef2ff', color: ACCENT, fontSize: '18pt',
  },
  number: {
    flexShrink: 0, width: '7mm', height: '7mm', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: ACCENT, color: '#fff', fontSize: '10pt', fontWeight: 800,
  },
};
