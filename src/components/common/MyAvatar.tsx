import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMyPhoto } from '../../api/profilePhoto.js';

// The signed-in person's round avatar: their profile photo when they've set
// one (My Profile), otherwise the first letter of their name.

export const MY_PHOTO_KEY = ['my-photo'];
/** The photo rarely changes — reloaded after an upload (invalidate MY_PHOTO_KEY). */
const PHOTO_STALE_MS = 30 * 60_000;

/** A blob URL for your photo, or null (none set, or still loading). */
export function useMyPhotoUrl(): string | null {
  const { data: blob } = useQuery({ queryKey: MY_PHOTO_KEY, queryFn: fetchMyPhoto, staleTime: PHOTO_STALE_MS, retry: false });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

interface Props {
  name: string;
  size: number;
  /** The letter avatar's look (colour, border…) — also the frame around the photo. */
  style?: React.CSSProperties;
}

export default function MyAvatar({ name, size, style }: Props) {
  const url = useMyPhotoUrl();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : (name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
