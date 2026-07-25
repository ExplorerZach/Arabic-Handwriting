import { useState, useEffect } from 'react';

const GH_API = 'https://api.github.com/repos/ExplorerZach/arabic-handwriting/releases/latest';
const GH_RELEASES_PAGE = 'https://github.com/ExplorerZach/arabic-handwriting/releases/latest';

export function useDownloadLinks() {
  const [links, setLinks] = useState({ win: null, mac: null, linux: null });
  const [fallback, setFallback] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(GH_API)
      .then(r => {
        if (!r.ok) throw new Error(`GitHub API: ${r.status}`);
        return r.json();
      })
      .then(release => {
        if (cancelled) return;
        const assets = release.assets || [];
        const result = { win: null, mac: null, linux: null };

        for (const a of assets) {
          const name = a.name;
          if (name.endsWith('.msi')) {
            result.win = a.browser_download_url;
          } else if (name.endsWith('.dmg')) {
            if (!result.mac || name.includes('aarch64')) {
              result.mac = a.browser_download_url;
            }
          } else if (name.endsWith('.AppImage')) {
            result.linux = a.browser_download_url;
          }
        }

        if (!cancelled) setLinks(result);
      })
      .catch(() => {
        if (!cancelled) setFallback(GH_RELEASES_PAGE);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { links, fallback };
}
