import { useState, useEffect } from 'react';

const MOBILE = 768;
const TABLET = 1024;

export function useIsMobile() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, []);

  return { isMobile: width < MOBILE, isTablet: width < TABLET, width };
}
