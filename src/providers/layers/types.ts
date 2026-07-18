export type LayerType = "raster-era" | "vector-dated";
export type TileScheme = "xyz" | "tms";
export type Bbox = readonly [number, number, number, number];

interface LayerEntryShape<EraTo extends number | null> {
  readonly id: string;
  readonly type: LayerType;
  readonly provider: string;
  readonly title: Readonly<{ ja: string; en: string }>;
  readonly era: Readonly<{ from: number; to: EraTo }>;
  readonly region: string;
  readonly coverage: readonly Bbox[];
  readonly tiles: Readonly<{
    urlTemplate: string;
    scheme: TileScheme;
    minzoom: number;
    maxzoom: number;
    tileSize: 256 | 512;
  }>;
  readonly attribution: Readonly<{
    text: string;
    url?: string;
    license: Readonly<{ name: string; url?: string }>;
  }>;
  readonly flags: Readonly<{
    experimental: boolean;
    requiresFeatureFlag: string | null;
  }>;
  readonly priority: number;
}

/** Data shape accepted from a registry JSON file before rolling-era normalization. */
export type LayerRegistryEntry = LayerEntryShape<number | null>;

/** Validated runtime shape. Rolling eras always have an explicit injected year. */
export type LayerEntry = LayerEntryShape<number>;

export interface RegistryEnv {
  readonly currentYear: number;
  readonly featureFlags: Readonly<Record<string, unknown>>;
  readonly warn?: (warning: RegistryWarning) => void;
}

export interface RegistryWarning {
  readonly index: number;
  readonly field: string;
  readonly reason: string;
}
