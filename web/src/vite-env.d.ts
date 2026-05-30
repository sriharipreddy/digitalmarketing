/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  /** Public base URL where the UTM click redirect lives (e.g. https://yourdomain.com or /api/v1/campaign). */
  readonly VITE_UTM_REDIRECT_BASE?: string;
  /** Public base URL for affiliate tracking-link clicks (e.g. https://go.yourdomain.com). */
  readonly VITE_AFFILIATE_REDIRECT_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
