/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// fontsource packages ship CSS side-effect imports without .d.ts files.
declare module "@fontsource-variable/geist";
declare module "@fontsource-variable/geist-mono";
