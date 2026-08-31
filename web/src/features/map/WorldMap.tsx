import { useEffect, useMemo, useRef, useState } from "react";
import MapLibreMap, {
  AttributionControl,
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Popup,
  Source,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";

import type { Campaign } from "../../state/campaign-store";
import { capitalProvinceByNationId } from "./east-asia-map";
import {
  buildOpenHistoriaMapData,
  type OpenHistoriaRegionProperties,
} from "./open-historia-map-data";
import {
  capitalLayer,
  constructionMarkerLayer,
  OPEN_HISTORIA_CONSTRUCTION_SOURCE,
  OPEN_HISTORIA_LABEL_SOURCE,
  OPEN_HISTORIA_REGION_SOURCE,
  OPEN_HISTORIA_UNIT_SOURCE,
  openHistoriaMapStyle,
  regionFillLayer,
  regionLabelLayer,
  regionLineLayer,
  selectedFillLayer,
  selectedLineLayer,
  unitCounterLayer,
  unitStrengthLabelLayer,
} from "./open-historia-map-style";

interface WorldMapProps {
  readonly campaign: Campaign;
  readonly nationNameById: ReadonlyMap<string, string>;
  readonly selectedNationId: string;
  readonly selectedProvinceId: string | null;
  readonly onSelectNation: (nationId: string) => void;
  readonly onSelectProvince: (provinceId: string) => void;
}

interface CameraSnapshot {
  readonly longitude: number;
  readonly latitude: number;
  readonly zoom: number;
}

const initialCamera: CameraSnapshot = {
  longitude: 124,
  latitude: 40,
  zoom: 3.45,
};

const cameraAttribute = (camera: CameraSnapshot): string =>
  `longitude=${camera.longitude.toFixed(4)};latitude=${camera.latitude.toFixed(4)};zoom=${camera.zoom.toFixed(3)}`;

export const WorldMap = ({
  campaign,
  nationNameById,
  selectedNationId,
  selectedProvinceId,
  onSelectNation,
  onSelectProvince,
}: WorldMapProps): JSX.Element => {
  const mapRef = useRef<MapRef | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState<"default" | "pointer" | "grab" | "grabbing">("grab");
  const [camera, setCamera] = useState<CameraSnapshot>(initialCamera);
  const mapData = useMemo(
    () => buildOpenHistoriaMapData(campaign, nationNameById),
    [campaign, nationNameById],
  );
  const selectedRegion = useMemo(
    () =>
      mapData.regions.features.find(
        (feature) => feature.properties.provinceId === selectedProvinceId,
      ),
    [mapData.regions.features, selectedProvinceId],
  );

  useEffect(() => {
    const capitalProvinceId = capitalProvinceByNationId[selectedNationId];
    const capital = mapData.regions.features.find(
      (feature) => feature.properties.provinceId === capitalProvinceId,
    );
    if (capital === undefined || mapRef.current === null) {
      return;
    }
    const [longitude, latitude] = capital.properties.labelAnchor;
    mapRef.current.flyTo({ center: [longitude, latitude], zoom: 4.8, duration: 800 });
  }, [mapData.regions.features, selectedNationId]);

  const selectFeature = (event: MapLayerMouseEvent): void => {
    const properties = event.features?.[0]?.properties as
      | Partial<OpenHistoriaRegionProperties>
      | undefined;
    const provinceId = properties?.provinceId;
    const ownerNationId = properties?.ownerNationId;
    if (typeof provinceId !== "string" || typeof ownerNationId !== "string") {
      return;
    }
    onSelectProvince(provinceId);
    onSelectNation(ownerNationId);
  };

  const updateCamera = (event: ViewStateChangeEvent): void => {
    setCamera({
      longitude: event.viewState.longitude,
      latitude: event.viewState.latitude,
      zoom: event.viewState.zoom,
    });
  };

  const selectedFilter: ["==", ["get", string], string] = [
    "==",
    ["get", "provinceId"],
    selectedProvinceId ?? "__no-selected-region__",
  ];

  return (
    <section
      className="oh_world"
      data-testid="open-historia-world"
      data-map-engine="maplibre"
      data-map-data-state={loaded ? "ready" : "loading"}
      data-region-count={mapData.regions.features.length}
      data-construction-count={mapData.constructions.features.length}
      data-unit-count={mapData.units.features.length}
      data-unit-provinces={mapData.unitProvinceIds.join(" ")}
      data-camera={cameraAttribute(camera)}
      aria-label="Open Historia MapLibre 동아시아 전략 지도"
    >
      <MapLibreMap
        ref={mapRef}
        initialViewState={initialCamera}
        mapStyle={openHistoriaMapStyle}
        minZoom={2}
        maxZoom={10}
        attributionControl={false}
        dragPan
        dragRotate={false}
        touchZoomRotate
        scrollZoom
        doubleClickZoom
        keyboard
        cursor={cursor}
        interactiveLayerIds={[regionFillLayer.id]}
        onClick={selectFeature}
        onLoad={(event) => {
          setLoaded(true);
          if (import.meta.env.DEV) {
            // Dev-only handle so end-to-end runs can read live MapLibre sources.
            Reflect.set(window, "__openHistoriaMap", event.target);
          }
        }}
        onMove={updateCamera}
        onMouseDown={() => setCursor("grabbing")}
        onMouseUp={() => setCursor("grab")}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("grab")}
        reuseMaps
      >
        <AttributionControl compact position="bottom-right" />
        <Source id={OPEN_HISTORIA_REGION_SOURCE} type="geojson" data={mapData.regions}>
          <Layer {...regionFillLayer} />
          <Layer {...regionLineLayer} />
          <Layer {...selectedFillLayer} filter={selectedFilter} />
          <Layer {...selectedLineLayer} filter={selectedFilter} />
        </Source>
        <Source id={OPEN_HISTORIA_LABEL_SOURCE} type="geojson" data={mapData.labels}>
          <Layer {...regionLabelLayer} />
          <Layer {...capitalLayer} />
        </Source>
        <Source id={OPEN_HISTORIA_CONSTRUCTION_SOURCE} type="geojson" data={mapData.constructions}>
          <Layer {...constructionMarkerLayer} />
        </Source>
        <Source id={OPEN_HISTORIA_UNIT_SOURCE} type="geojson" data={mapData.units}>
          <Layer {...unitCounterLayer} />
          <Layer {...unitStrengthLabelLayer} />
        </Source>
        {selectedRegion === undefined ? null : (
          <Popup
            longitude={selectedRegion.properties.labelAnchor[0]}
            latitude={selectedRegion.properties.labelAnchor[1]}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={12}
            className="oh_region_popup"
          >
            <div className="oh_popup_title">
              <strong>{selectedRegion.properties.label}</strong>
              <span>· {selectedRegion.properties.ownerName}</span>
            </div>
            <small>인구 {selectedRegion.properties.population.toLocaleString("ko-KR")}</small>
          </Popup>
        )}
      </MapLibreMap>
      <div className="oh_map_vignette" aria-hidden="true" />
    </section>
  );
};
