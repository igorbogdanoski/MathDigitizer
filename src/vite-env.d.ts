/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_INGESTION_POLICY_USER_INPUT_MODE?: 'strict' | 'advisory';
  readonly VITE_INGESTION_POLICY_SOURCE_CONTENT_MODE?: 'strict' | 'advisory';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
