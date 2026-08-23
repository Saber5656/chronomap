/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_E2E?: string;
  readonly VITE_ENABLE_KONJAKU?: string;
  readonly VITE_ENABLE_COMMONS_PHOTOS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
