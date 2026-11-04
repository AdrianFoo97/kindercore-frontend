import { copyLink, guideShareUrl } from '../../utils/shareLink.js';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

/**
 * Copy a guide's link, from the library list or the guide page. The link only
 * opens for signed-in staff with Operation access — the message says so, so
 * nobody expects a parent or outsider to be able to read it.
 */
export async function copyGuideLink(guideId: string, showToast: ShowToast): Promise<void> {
  const copied = await copyLink(guideShareUrl(guideId));
  if (copied) showToast('Link copied — only signed-in staff with access can open it');
  else showToast('Could not copy the link', 'error');
}
