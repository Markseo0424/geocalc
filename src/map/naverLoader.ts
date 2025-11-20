export async function loadNaver(clientId: string): Promise<void> {
  if ((window as any).naver?.maps) return;
  if (!clientId) console.warn('Naver clientId is empty.');
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(clientId || '')}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Naver Maps JS'));
    document.head.appendChild(s);
  });
}