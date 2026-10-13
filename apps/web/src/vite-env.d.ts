/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Prénom du porteur, affiché dans « hébergé chez <prénom> » (03 §13.1). */
  readonly VITE_OWNER_FIRST_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
