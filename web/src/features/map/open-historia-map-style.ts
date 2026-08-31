import type {
  CircleLayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  StyleSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

export const OPEN_HISTORIA_REGION_SOURCE = "open-historia-regions";
export const OPEN_HISTORIA_LABEL_SOURCE = "open-historia-labels";

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
