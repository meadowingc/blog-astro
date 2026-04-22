/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Bearer token for the Readeck API, used at build time by `src/utils/readeck.ts`. */
  readonly READECK_TOKEN: string;
  /** Optional override for the Readeck base URL (defaults to https://readeck.meadow.cafe). */
  readonly READECK_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
