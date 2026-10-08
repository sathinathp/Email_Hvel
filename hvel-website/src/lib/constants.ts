export const EXTENSION_DOWNLOAD_URL = 'https://chromewebstore.google.com/detail/emgidilonchdpmibbcjlbgkddmpcfmpa?utm_source=item-share-cb';

export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
      return `http://${window.location.hostname}:5000`;
    }
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.page';
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.attest.page';
};

export const BACKEND_URL = getBackendUrl();

