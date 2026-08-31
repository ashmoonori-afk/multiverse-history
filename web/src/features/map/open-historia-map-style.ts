import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  StyleSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

export const OPEN_HISTORIA_REGION_SOURCE = "open-historia-regions";
export const OPEN_HISTORIA_LABEL_SOURCE = "open-historia-labels";
export const OPEN_HISTORIA_CONSTRUCTION_SOURCE = "open-historia-construction";
export const OPEN_HISTORIA_UNIT_SOURCE = "open-historia-units";

/**
 * MapLibre paints on a WebGL canvas and cannot read CSS custom properties, so these
 * mirror the design tokens they are named after in `web/src/styles/tokens.css`.
 */
const mapPalette = {
  economy: "#d7b45a", // --color-economy
  textStrong: "#f3f1e9", // --color-text-strong
  canvas: "#070a0f", // --color-canvas
} as const;

export const openHistoriaMapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "esri-world-relief": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [
    {
      id: "world-background",
      type: "background",
      paint: { "background-color": "#111827" },
    },
    {
      id: "world-relief",
      type: "raster",
      source: "esri-world-relief",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": -0.28,
        "raster-contrast": -0.12,
        "raster-brightness-min": 0.16,
        "raster-brightness-max": 1,
      },
    },
  ],
};

export const regionFillLayer = {
  id: "open-historia-region-fill",
  type: "fill",
  source: OPEN_HISTORIA_REGION_SOURCE,
  paint: {
    "fill-color": ["get", "fillColor"],
    "fill-opacity": ["case", ["boolean", ["get", "changed"], false], 0.7, 0.5],
    "fill-antialias": true,
  },
} satisfies FillLayerSpecification;

export const regionLineLayer = {
  id: "open-historia-region-line",
  type: "line",
  source: OPEN_HISTORIA_REGION_SOURCE,
  paint: {
    "line-color": "rgba(226,232,240,0.76)",
    "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.45, 5, 0.9, 8, 1.5],
    "line-opacity": 0.8,
  },
} satisfies LineLayerSpecification;

export const selectedFillLayer = {
  id: "open-historia-selected-fill",
  type: "fill",
  source: OPEN_HISTORIA_REGION_SOURCE,
  paint: {
    "fill-color": "#f8fafc",
    "fill-opacity": 0.2,
  },
} satisfies FillLayerSpecification;

export const selectedLineLayer = {
  id: "open-historia-selected-line",
  type: "line",
  source: OPEN_HISTORIA_REGION_SOURCE,
  paint: {
    "line-color": "#ffffff",
    "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.8, 7, 3.2],
    "line-blur": 0.35,
  },
} satisfies LineLayerSpecification;

export const regionLabelLayer = {
  id: "open-historia-region-label",
  type: "symbol",
  source: OPEN_HISTORIA_LABEL_SOURCE,
  minzoom: 3.1,
  layout: {
    "text-field": ["get", "label"],
    "text-font": ["Open Sans Semibold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9, 5, 11, 8, 14],
    "text-letter-spacing": 0.04,
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "rgba(255,255,255,0.72)",
    "text-opacity": 0.62,
    "text-halo-color": "rgba(5,8,15,0.72)",
    "text-halo-width": 1,
    "text-halo-blur": 0.25,
  },
} satisfies SymbolLayerSpecification;

export const capitalLayer = {
  id: "open-historia-capitals",
  type: "circle",
  source: OPEN_HISTORIA_LABEL_SOURCE,
  filter: ["==", ["get", "isCapital"], true],
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3.5, 7, 6],
    "circle-color": "#f8fafc",
    "circle-stroke-color": "#111827",
    "circle-stroke-width": 2,
  },
} satisfies CircleLayerSpecification;

/** Rail works read as an economy-tinted node offset off the province anchor. */
export const constructionMarkerLayer = {
  id: "open-historia-construction-marker",
  type: "circle",
  source: OPEN_HISTORIA_CONSTRUCTION_SOURCE,
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 5, 4.5, 8, 7],
    "circle-color": mapPalette.economy,
    "circle-opacity": 0.92,
    "circle-stroke-color": mapPalette.canvas,
    "circle-stroke-width": 1.4,
    "circle-translate": [-11, -11],
  },
} satisfies CircleLayerSpecification;

/** Presence and strength: one owner-tinted counter per unit, sized by manpower. */
export const unitCounterLayer = {
  id: "open-historia-unit-counter",
  type: "circle",
  source: OPEN_HISTORIA_UNIT_SOURCE,
  layout: {
    "circle-sort-key": ["-", 0, ["get", "manpower"]],
  },
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      ["interpolate", ["linear"], ["get", "manpower"], 0, 5, 20000, 8.5],
      8,
      ["interpolate", ["linear"], ["get", "manpower"], 0, 8, 20000, 14],
    ],
    "circle-color": ["get", "accentColor"],
    "circle-opacity": 1,
    "circle-stroke-color": mapPalette.canvas,
    "circle-stroke-width": 1.6,
    "circle-translate": [10, 10],
  },
} satisfies CircleLayerSpecification;

/** Per-unit readout; stacked units fan vertically so a stack stays legible. */
export const unitStrengthLabelLayer = {
  id: "open-historia-unit-strength",
  type: "symbol",
  source: OPEN_HISTORIA_UNIT_SOURCE,
  minzoom: 3.4,
  layout: {
    "text-field": ["get", "strengthLabel"],
    "text-font": ["Open Sans Semibold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9, 8, 12],
    "text-allow-overlap": true,
    "text-offset": [
      "case",
      ["==", ["get", "stackIndex"], 0],
      ["literal", [1.4, 0.1]],
      ["==", ["get", "stackIndex"], 1],
      ["literal", [1.4, 1.3]],
      ["literal", [1.4, 2.5]],
    ],
  },
  paint: {
    "text-color": mapPalette.textStrong,
    "text-halo-color": mapPalette.canvas,
    "text-halo-width": 1.4,
    // Matches the counter's screen offset so label and counter read as one unit.
    "text-translate": [10, 10],
  },
} satisfies SymbolLayerSpecification;
