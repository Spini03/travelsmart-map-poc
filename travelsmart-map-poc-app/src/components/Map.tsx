"use client";

import React, { useMemo, useState, useCallback } from "react";
import DeckGL from "@deck.gl/react";
import {
  ScatterplotLayer,
  ArcLayer,
  TextLayer,
  BitmapLayer,
} from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import {
  COORDINATE_SYSTEM,
  _GlobeView as GlobeView,
  type PickingInfo,
} from "@deck.gl/core";
import type { Destination } from "./ItinerarySidebar";

type Props = {
  itinerary: Destination[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
};

export default function MapComponent({
  itinerary,
  selectedId,
  onSelect,
}: Props) {
  const initialViewState = {
    longitude: itinerary[0]?.coordinates[0] ?? 0,
    latitude: itinerary[0]?.coordinates[1] ?? 20,
    zoom: 0.5,
    bearing: 0,
    pitch: 0,
  } as const;

  const [clickInfo, setClickInfo] = useState<PickingInfo | null>(null);

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info?.object) {
        const obj = info.object as Destination & { index?: number };
        onSelect?.(obj.id);
        setClickInfo(info);
      } else {
        setClickInfo(null);
      }
    },
    [onSelect]
  );

  const layers = useMemo(() => {
    const tileLayer = new TileLayer({
      id: "base-map-layer",
      // ESRI World Imagery (generous dev usage, CORS enabled)
      data: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      loadOptions: {
        image: { type: "imagebitmap" },
        fetch: { mode: "cors", credentials: "omit" },
      },
      renderSubLayers: (subProps) => {
        const bbox: any = (subProps as any).tile?.bbox;
        const bounds: [number, number, number, number] = Array.isArray(bbox)
          ? [bbox[0], bbox[1], bbox[2], bbox[3]]
          : [bbox.west, bbox.south, bbox.east, bbox.north];
        return new BitmapLayer(subProps, {
          id: `${subProps.id}-bitmap`,
          // IMPORTANT: override data to avoid treating image as iterable
          data: undefined,
          image: (subProps as any).data,
          bounds,
          opacity: 1,
        });
      },
    });

    const arcsData =
      itinerary.length > 1
        ? itinerary.slice(0, -1).map((city, i) => {
            const a = city.coordinates;
            const b = itinerary[i + 1].coordinates;
            return {
              from: [a[0], a[1]] as [number, number],
              to: [b[0], b[1]] as [number, number],
            };
          })
        : [];

    const isSelected = (d: Destination) =>
      selectedId ? d.id === selectedId : false;

    return [
      tileLayer,
      new ScatterplotLayer<Destination>({
        id: "points",
        data: itinerary,
        pickable: true,
        getPosition: (d) => d.coordinates,
        getRadius: (d) => (isSelected(d) ? 9 : 7),
        radiusUnits: "pixels",
        getFillColor: (d) => (isSelected(d) ? [58, 165, 255] : [29, 161, 242]),
        getLineColor: [0, 0, 0, 120],
        lineWidthMinPixels: 1,
        onClick: handleClick,
        coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      }),
      new ArcLayer({
        id: "arc-layer",
        data: arcsData,
        getSourcePosition: (d: { from: [number, number] }) => d.from,
        getTargetPosition: (d: { to: [number, number] }) => d.to,
        getSourceColor: [100, 200, 255, 160],
        getTargetColor: [100, 200, 255, 160],
        getWidth: 2,
        greatCircle: true,
        pickable: false,
        coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      }),
      new TextLayer<Destination & { order: number }>({
        id: "labels",
        data: itinerary.map((d, i) => ({ ...d, order: i + 1 })),
        pickable: false,
        getPosition: (d) => d.coordinates,
        getText: (d) => String(d.order),
        getSize: 14,
        sizeUnits: "pixels",
        sizeScale: 1,
        getColor: [255, 255, 255],
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        getPixelOffset: [0, 0],
        coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      }),
    ];
  }, [itinerary, selectedId, handleClick]);

  return (
    <div className="absolute inset-0" style={{ background: "#000020" }}>
      <DeckGL
        layers={layers}
        views={new GlobeView({ id: "globe" })}
        controller={true}
        initialViewState={initialViewState}
        getTooltip={(info) =>
          info.object
            ? {
                text: `${(info.object as Destination).city} — ${
                  (info.object as Destination).days
                } day(s)`,
              }
            : null
        }
      />

      {clickInfo && clickInfo.object && (
        <div
          className="absolute z-10 rounded bg-black/80 text-white text-xs shadow p-2"
          style={{
            left: clickInfo.x,
            top: clickInfo.y,
            transform: "translate(8px, 8px)",
          }}
          onClick={() => setClickInfo(null)}
        >
          <div className="font-semibold">
            {(clickInfo.object as Destination).city}
          </div>
          <div className="text-neutral-300">
            Days: {(clickInfo.object as Destination).days}
          </div>
        </div>
      )}
    </div>
  );
}
