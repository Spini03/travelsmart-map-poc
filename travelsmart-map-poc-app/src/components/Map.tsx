"use client";

import React, { useMemo } from "react";
import Map from "react-map-gl/mapbox";
import { DeckGL, ScatterplotLayer, ArcLayer } from "deck.gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MOCK_ITINERARY = [
  { id: 1, city: "Madrid", coordinates: [-3.7038, 40.4168] },
  { id: 2, city: "París", coordinates: [2.3522, 48.8566] },
  { id: 3, city: "Ámsterdam", coordinates: [4.8952, 52.3702] },
  { id: 4, city: "Roma", coordinates: [12.4964, 41.9028] },
];

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function MapComponent() {
  const initialViewState = {
    longitude: 2.3522,
    latitude: 48.8566,
    zoom: 4,
    pitch: 45,
    bearing: 0,
  };

  const layers = useMemo(
    () => [
      new ScatterplotLayer({
        id: "scatterplot-layer",
        data: MOCK_ITINERARY,
        getPosition: (d) => d.coordinates,
        getRadius: 10000,
        getFillColor: [29, 161, 242],
      }),
      new ArcLayer({
        id: "arc-layer",
        data: MOCK_ITINERARY.slice(0, -1).map((city, index) => ({
          from: city.coordinates,
          to: MOCK_ITINERARY[index + 1].coordinates,
        })),
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getSourceColor: [29, 161, 242],
        getTargetColor: [29, 161, 242],
        getStrokeWidth: 3,
      }),
    ],
    []
  );

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Map
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN ?? ""}
      >
        <DeckGL layers={layers} />
      </Map>
    </div>
  );
}
