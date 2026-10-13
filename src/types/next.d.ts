declare module "next" {
  export interface NextConfig {
    [key: string]: unknown;
  }
  export interface Metadata {
    title?: string | { default: string; template?: string };
    description?: string;
    keywords?: string | string[];
    [key: string]: unknown;
  }
}

declare module "next/types.js" {
  export type ResolvingMetadata = Promise<Record<string, unknown>>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}

declare module "next/dist/lib/metadata/types/metadata-interface.js" {
  export type ResolvingMetadata = Promise<Record<string, unknown>>;
  export type ResolvingViewport = Promise<Record<string, unknown>>;
}

declare module "next/dist/build/segment-config/app/app-segment-config.js" {
  export type InstantConfigForTypeCheckInternal = unknown;
  export type Prefetch = unknown;
  export type EnsureStatic = unknown;
  export type AppSegmentConfig = Record<string, unknown>;
}

