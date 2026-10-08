export const EXTENSION_DOWNLOAD_URL = 'https://chromewebstore.google.com/detail/emgidilonchdpmibbcjlbgkddmpcfmpa?utm_source=item-share-cb';

export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:5000`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
};

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
