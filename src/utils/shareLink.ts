// Copy a shareable link to the clipboard — no share sheet, just the link,
// ready to paste into WhatsApp or anywhere else.

export async function copyLink(url: string, clipboard: Pick<Clipboard, 'writeText'> = navigator.clipboard): Promise<boolean> {
  try {
    await clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/** The one link to send for a guide; /guide/:id picks teacher or admin view for whoever opens it. */
export function guideShareUrl(templateId: string, origin: string = window.location.origin): string {
  return `${origin}/guide/${encodeURIComponent(templateId)}`;
}
