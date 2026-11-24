import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPrint } from '@fortawesome/free-solid-svg-icons';
import { fetchPosterImage, fetchTemplates, type SopTemplate } from '../../../api/sop-templates.js';
import { fetchSteps } from '../../../api/sop-steps.js';
import { fetchGuideImage } from '../../../api/guideImages.js';
import { guideShareUrl } from '../../../utils/shareLink.js';
import { useGoBack } from '../../../hooks/useGoBack.js';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { TEACHER_CONTENT_TOP } from '../../../components/common/TeacherTopBar.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { GUIDE_IMAGE_KEY } from '../guidePhotos/StepPhoto.js';
import { posterPages, type PosterPage } from './posterLayout.js';
import { posterOutdated, posterView } from './posterView.js';
import { POSTER_C, PRINT_CSS, SHEET_PX } from './posterSheet.js';
import { SimplePosterSheet } from './SimplePoster.js';
import AiPosterSheet, { POSTER_IMAGE_KEY } from './AiPosterSheet.js';
import PosterAiControls from './PosterAiControls.js';

// How-To Guide → Poster (/operations/sops/:templateId/poster). Shows the
// guide's AI poster — drawn once by a guide author and saved, so opening it
// never redraws it — or, until there is one, the simple poster the app lays
// out from the steps. Authors also get the AI controls (make / check / use).
// Print → the browser's print dialog (or Save as PDF): the sheets are drawn
// twice, a scaled preview on screen and full size in a print-only layer.

export default function GuidePosterPage() {
  const { templateId = '' } = useParams();
  const [params] = useSearchParams();
  const fromTeacherApp = params.get('app') === 'teacher';
  const { isMobile } = useIsMobile();
  const { hasView } = usePermissions();
  const goBack = useGoBack(`/operations/sops/${templateId}${fromTeacherApp ? '?app=teacher' : ''}`);
  const isAuthor = isAdminUser() || hasView('OPERATION_SOP_APPROVE');

  const templates = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const steps = useQuery({ queryKey: ['sop-steps', templateId], queryFn: () => fetchSteps(templateId), enabled: !!templateId });
  const template = templates.data?.find(t => t.id === templateId);
  const pages = useMemo(() => posterPages((steps.data ?? []).map(s => ({ id: s.id, section: s.section, title: s.title, imageId: s.imageId }))), [steps.data]);
  const view = template ? posterView(template, isAuthor) : 'simple';

  const qr = useQrCode(guideShareUrl(templateId));
  const [previewRef, scale] = usePreviewScale();
  const simpleReady = useStepPhotosLoaded(view === 'simple' ? steps.data?.flatMap(s => (s.imageId ? [s.imageId] : [])) ?? [] : []);
  // Same cache entry the AI sheet loads — only to know when it's ready to print.
  const aiImageId = view === 'ai' ? template?.posterImageId ?? null : null;
  const aiImage = useQuery({
    queryKey: [...POSTER_IMAGE_KEY, templateId, aiImageId], queryFn: () => fetchPosterImage(templateId, aiImageId!),
    enabled: !!aiImageId, staleTime: Infinity, retry: false,
  });

  const pagePad: React.CSSProperties = {
    padding: isMobile ? `${fromTeacherApp ? TEACHER_CONTENT_TOP : 16}px 16px 40px` : '24px 32px 48px',
    background: POSTER_C.bg, minHeight: '100vh', boxSizing: 'border-box',
  };

  if (templates.isPending || steps.isPending) return <div style={pagePad}><LoadingSpinner /></div>;
  if (templates.isError || steps.isError || !template) {
    return (
      <div style={pagePad}>
        <p style={{ fontSize: 14, color: POSTER_C.sub }}>{templates.isError || steps.isError ? 'Couldn’t load this guide.' : 'This guide isn’t available.'}</p>
        <button type="button" onClick={() => { void templates.refetch(); void steps.refetch(); }} style={s.secondary}>Retry</button>
      </div>
    );
  }

  const outdated = posterOutdated(template);
  const printable = view === 'ai' ? aiImage.isSuccess : view === 'simple' ? simpleReady && pages.length > 0 : false;
  const printHint = view === 'draft' ? 'Use or discard the new poster first' : !printable ? 'Loading…' : 'Print, or choose “Save as PDF” in the print dialog';
  const sheets = (forPrint: boolean) => renderSheets(view, template, pages, qr, forPrint ? undefined : { zoom: scale, marginBottom: 24 * scale });

  return (
    <div style={pagePad}>
      <style>{PRINT_CSS}</style>
      <div style={{ maxWidth: SHEET_PX, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          {!(fromTeacherApp && isMobile) && (
            <button type="button" onClick={goBack} style={s.secondary} aria-label="Back to the guide">
              <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} /> Back
            </button>
          )}
          <span style={{ fontSize: 13, color: POSTER_C.muted, marginRight: 'auto' }}>
            {view === 'simple' && pages.length === 0 ? 'This guide has no steps yet.' : view === 'simple' ? `A4 · ${pages.length === 1 ? '1 page' : `${pages.length} pages`}` : 'A4 · 1 page'}
          </span>
          <button type="button" onClick={() => window.print()} disabled={!printable} title={printHint}
            style={{ ...s.primary, opacity: printable ? 1 : 0.55, cursor: printable ? 'pointer' : 'default' }}>
            <FontAwesomeIcon icon={faPrint} style={{ marginRight: 6 }} /> Print / Save as PDF
          </button>
        </div>
        {isAuthor && <PosterAiControls template={template} view={view} outdated={outdated} />}
        {!isAuthor && view === 'ai' && outdated && (
          <p role="status" style={{ margin: '0 0 16px', fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
            This poster was made before the guide last changed — the guide itself has the latest steps.
          </p>
        )}
      </div>
      <div ref={previewRef} style={{ maxWidth: SHEET_PX, margin: '0 auto' }}>{sheets(false)}</div>
      {view !== 'draft' && createPortal(<div className="poster-print">{sheets(true)}</div>, document.body)}
    </div>
  );
}

function renderSheets(view: ReturnType<typeof posterView>, template: SopTemplate, pages: PosterPage[], qr: string | null, style?: React.CSSProperties) {
  if (view !== 'simple') {
    const imageId = view === 'draft' ? template.posterDraftImageId! : template.posterImageId!;
    return <AiPosterSheet templateId={template.id} imageId={imageId} title={template.title} style={style} />;
  }
  return pages.map((page, i) => (
    <SimplePosterSheet key={i} template={template} page={page} pageNo={i + 1} pageCount={pages.length} qr={qr} style={style} />
  ));
}

function isAdminUser(): boolean {
  try {
    const role = (JSON.parse(localStorage.getItem('user') ?? 'null') as { role?: string } | null)?.role;
    return role === 'ADMIN' || role === 'SUPERADMIN';
  } catch {
    return false;
  }
}

/** The QR code (a data URL) pointing at the full guide. */
function useQrCode(text: string): string | null {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: 'M' })
      .then(url => { if (live) setQr(url); })
      .catch(() => { if (live) setQr(null); });
    return () => { live = false; };
  }, [text]);
  return qr;
}

/** True once every step photo has arrived (or failed) — so none print blank. */
function useStepPhotosLoaded(imageIds: string[]): boolean {
  const photos = useQueries({
    queries: imageIds.map(id => ({ queryKey: [...GUIDE_IMAGE_KEY, id], queryFn: () => fetchGuideImage(id), staleTime: Infinity, retry: false })),
  });
  return photos.every(p => !p.isPending);
}

/**
 * Scale for the on-screen sheets: full size when there's room, smaller on a phone.
 * A callback ref, so it measures once the sheets appear (they're not there while loading).
 */
function usePreviewScale(): [(el: HTMLDivElement | null) => void, number] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / SHEET_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, scale];
}

const s: Record<string, React.CSSProperties> = {
  primary: {
    display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: '#5a67d8', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  },
  secondary: {
    display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${POSTER_C.border}`,
    background: '#fff', color: POSTER_C.sub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
};
