let globalLoaderPromise: Promise<void> | null = (window as any).__naverLoaderPromise || null;

function listExistingNaverScripts(): HTMLScriptElement[] {
  const scripts = Array.from(document.querySelectorAll('script')) as HTMLScriptElement[];
  return scripts.filter((s) => s.src.includes('oapi.map.naver.com/openapi/v3/maps.js'));
}

function waitForNaverLoaded(timeoutMs = 15000): Promise<void> {
  if ((window as any).naver?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if ((window as any).naver?.maps) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Naver Maps JS did not become available within timeout'));
      }
    }, 50);
  });
}

export async function loadNaver(clientId: string): Promise<void> {
  const trimmedId = (clientId || '').trim();
  const maskedId = trimmedId ? `${trimmedId.slice(0, 4)}***` : '(empty)';

  // If already loaded, just resolve
  if ((window as any).naver?.maps) {
    console.info('[NaverLoader] naver.maps already present. origin=', location.origin, 'clientId=', maskedId);
    return;
  }

  // If a loader promise exists (HMR/duplicate), reuse it
  if (globalLoaderPromise) {
    console.info('[NaverLoader] Reusing existing loader promise. origin=', location.origin, 'clientId=', maskedId);
    return globalLoaderPromise;
  }

  const existing = listExistingNaverScripts();
  if (existing.length > 0) {
    try {
      const infos = existing.map((s) => {
        try {
          const u = new URL(s.src);
          return { src: s.src, id: u.searchParams.get('ncpClientId') };
        } catch {
          return { src: s.src, id: null } as const;
        }
      });
      console.info('[NaverLoader] Found existing maps.js scripts:', infos);
      const matched = infos.find((i) => i.id && trimmedId && i.id === trimmedId);
      if (!matched) {
        console.warn('[NaverLoader] No existing script matched provided clientId. Will wait for naver.maps if already loading. Provided clientId=', maskedId);
      }
    } catch {}
    globalLoaderPromise = waitForNaverLoaded();
    (window as any).__naverLoaderPromise = globalLoaderPromise;
    return globalLoaderPromise;
  }

  if (!trimmedId) {
    console.warn('[NaverLoader] Client ID is empty. The script will still be injected but will likely fail auth. origin=', location.origin);
  }

  console.info('[NaverLoader] Injecting maps.js. origin=', location.origin, 'clientId=', maskedId);
  globalLoaderPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(trimmedId)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      // In some cases onload fires but naver.maps may still be initializing; wait until ready
      waitForNaverLoaded().then(resolve).catch(reject);
    };
    s.onerror = () => reject(new Error('Failed to load Naver Maps JS'));
    // Tag for debugging
    s.setAttribute('data-loader', 'naver-maps');
    s.setAttribute('data-clientid', maskedId);
    document.head.appendChild(s);
  });
  (window as any).__naverLoaderPromise = globalLoaderPromise;
  return globalLoaderPromise;
}