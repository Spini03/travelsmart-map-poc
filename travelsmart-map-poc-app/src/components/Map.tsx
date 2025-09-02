"use client";

import React, { useMemo, useState, useCallback } from "react";
import Map, { Popup } from "react-map-gl/mapbox";
import {
  DeckGL,
  ScatterplotLayer,
  ArcLayer,
  TextLayer,
  PickingInfo,
} from "deck.gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Destination } from "./ItinerarySidebar";

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

type Props = {
  itinerary: Destination[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onClearSelection?: () => void;
};

export default function MapComponent({
  itinerary,
  selectedId,
  onSelect,
  onClearSelection,
}: Props) {
  const initialViewState = {
    longitude: itinerary[0]?.coordinates[0] ?? 2.3522,
    latitude: itinerary[0]?.coordinates[1] ?? 48.8566,
    zoom: 4,
    pitch: 45,
    bearing: 0,
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
    // build arcs data from ordered itinerary
    const arcsData = itinerary
      .slice(0, -1)
      .map((city, i) => ({
        from: city.coordinates,
        to: itinerary[i + 1].coordinates,
      }));

    const isSelected = (d: Destination) =>
      selectedId ? d.id === selectedId : false;

    return [
      new ArcLayer({
        id: "arc-layer",
        data: arcsData,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getSourceColor: [100, 200, 255, 160],
        getTargetColor: [100, 200, 255, 160],
        getWidth: 2,
        greatCircle: true,
        pickable: false,
      }),
      new ScatterplotLayer<Destination>({
        id: "points",
        data: itinerary,
        pickable: true,
        getPosition: (d) => d.coordinates,
        getRadius: (d) => (isSelected(d) ? 14000 : 11000),
        radiusUnits: "meters",
        getFillColor: (d) => (isSelected(d) ? [58, 165, 255] : [29, 161, 242]),
        getLineColor: [0, 0, 0, 120],
        lineWidthMinPixels: 1,
        onClick: handleClick,
      }),
      new TextLayer<Destination & { order: number }>({
        id: "labels",
        data: itinerary.map((d, i) => ({ ...d, order: i + 1 })),
        pickable: false,
        getPosition: (d) => d.coordinates,
        getText: (d) => String(d.order),
        getSize: 16,
        sizeUnits: "meters",
        sizeScale: 1000,
        getColor: [255, 255, 255],
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        getPixelOffset: [0, 0],
      }),
    ];
  }, [itinerary, selectedId, handleClick]);

  return (
    <div className="w-full h-full relative">
      <Map
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN ?? ""}
      >
        <DeckGL
          layers={layers}
          controller={true}
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
          <Popup
            longitude={(clickInfo.object as Destination).coordinates[0]}
            latitude={(clickInfo.object as Destination).coordinates[1]}
            anchor="top"
            onClose={() => setClickInfo(null)}
            closeOnClick={false}
          >
            <div className="text-sm">
              <div className="font-semibold">
                {(clickInfo.object as Destination).city}
              </div>
              <div className="text-neutral-500">
                Days: {(clickInfo.object as Destination).days}
              </div>
              <div className="mt-2 text-neutral-400 max-w-60">
                Placeholder details about this destination. Add notes,
                activities, or links here.
              </div>
            </div>
          </Popup>
        )}

        {/* Also show popup when a destination is selected from sidebar */}
        {!clickInfo &&
          selectedId != null &&
          (() => {
            const sel = itinerary.find((d) => d.id === selectedId);
            if (!sel) return null;
            return (
              <Popup
                longitude={sel.coordinates[0]}
                latitude={sel.coordinates[1]}
                anchor="top"
                onClose={() =>
                  onClearSelection
                    ? onClearSelection()
                    : onSelect?.(null as unknown as number)
                }
                closeOnClick={false}
              >
                <div className="text-sm">
                  <div className="font-semibold">{sel.city}</div>
                  <div className="text-neutral-500">Days: {sel.days}</div>
                  <div className="mt-2 text-neutral-400 max-w-60">
                    Placeholder details about this destination. Add notes,
                    activities, or links here.
                  </div>
                </div>
              </Popup>
            );
          })()}
      </Map>
    </div>
  );
}
