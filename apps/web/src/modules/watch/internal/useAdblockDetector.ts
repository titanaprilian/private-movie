import { useEffect, useState } from 'react';

export interface AdblockDetectorResult {
  isLoading: boolean;
  isBlocked: boolean;
}

export function useAdblockDetector(): AdblockDetectorResult {
  const [state, setState] = useState<AdblockDetectorResult>({
    isLoading: true,
    isBlocked: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function checkAdblock() {
      let isBlocked = false;

      // Probe 1: Network bait (request to known ad script URL)
      try {
        const baitUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        const res = await fetch(baitUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
        });
        if (!res) {
          isBlocked = true;
        }
      } catch {
        // Network blocker actively blocked the connection
        isBlocked = true;
      }

      // Probe 2: DOM bait (element with common ad container class names)
      if (!isBlocked && typeof document !== 'undefined') {
        const bait = document.createElement('div');
        bait.className =
          'adsbox ad-placement pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads';
        bait.style.position = 'absolute';
        bait.style.top = '-9999px';
        bait.style.left = '-9999px';
        bait.style.height = '10px';
        bait.style.width = '10px';
        bait.setAttribute('aria-hidden', 'true');

        document.body.appendChild(bait);

        const style = window.getComputedStyle(bait);
        const isHidden =
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          bait.getAttribute('data-adblock-hidden') === 'true';

        if (isHidden) {
          isBlocked = true;
        }

        if (bait.parentNode) {
          bait.parentNode.removeChild(bait);
        }
      }

      if (isMounted) {
        setState({
          isLoading: false,
          isBlocked,
        });
      }
    }

    checkAdblock();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
