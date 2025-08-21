/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_COMPANYCAM_API_KEY: string;
  readonly VITE_APP_DEFAULT_USER_ID: string;
  readonly VITE_DEMO_API_KEY?: string;
  // Add other environment variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
