"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl/mapbox";
import type { GeoJSONFeature, Map as MbMap } from "mapbox-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
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
  const initialViewState = useMemo(
    () =>
      ({
        longitude: itinerary[0]?.coordinates[0] ?? 0,
        latitude: itinerary[0]?.coordinates[1] ?? 20,
        zoom: 1.4,
        bearing: 0,
        pitch: 0,
      } as const),
    [itinerary]
  );

  // Great-circle interpolation between two lon/lat points
  const greatCircle = useCallback(
    (
      from: [number, number],
      to: [number, number],
      steps = 64
    ): [number, number][] => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const toDeg = (r: number) => (r * 180) / Math.PI;
      const [lon1, lat1] = [toRad(from[0]), toRad(from[1])];
      const [lon2, lat2] = [toRad(to[0]), toRad(to[1])];

      // Convert to 3D unit vectors
      const xyz = (lon: number, lat: number) =>
        [
          Math.cos(lat) * Math.cos(lon),
          Math.cos(lat) * Math.sin(lon),
          Math.sin(lat),
        ] as const;
      const a = xyz(lon1, lat1);
      const b = xyz(lon2, lat2);

      // Angle between vectors
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const omega = Math.acos(Math.min(1, Math.max(-1, dot)));
      if (omega === 0) return [from, to];

      const coords: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const sin_omega = Math.sin(omega);
        const k1 = Math.sin((1 - t) * omega) / sin_omega;
        const k2 = Math.sin(t * omega) / sin_omega;
        const x = k1 * a[0] + k2 * b[0];
        const y = k1 * a[1] + k2 * b[1];
        const z = k1 * a[2] + k2 * b[2];
        const r = Math.sqrt(x * x + y * y + z * z);
        const lon = Math.atan2(y / r, x / r);
        const lat = Math.asin(z / r);
        coords.push([toDeg(lon), toDeg(lat)]);
      }
      return coords;
    },
    []
  );

  const pointsGeoJSON = useMemo<FeatureCollection<Point>>(() => {
    return {
      type: "FeatureCollection",
      features: itinerary.map(
        (d, i): Feature<Point> => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: d.coordinates },
          properties: {
            id: d.id,
            city: d.city,
            days: d.days,
            order: i + 1,
            selected: selectedId ? d.id === selectedId : false,
          },
        })
      ),
    };
  }, [itinerary, selectedId]);

  // Mapbox token
  const rawToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const token =
    rawToken &&
    rawToken !== "SET_YOUR_TOKEN_OR_LEAVE_EMPTY" &&
    rawToken.trim().length > 0 &&
    rawToken.startsWith("pk.")
      ? rawToken
      : null;

  // Build leg routes (Directions for road-following; great-circle otherwise)
  const [routesGeoJSON, setRoutesGeoJSON] = useState<
    FeatureCollection<LineString>
  >({
    type: "FeatureCollection",
    features: [],
  });

  useEffect(() => {
    let cancelled = false;

    const toProfile = (t?: string) => {
      switch (t) {
        case "car":
          return "driving";
        case "walk":
          return "walking";
        case "bike":
          return "cycling";
        // train/plane not supported by Directions → fall back to great-circle
        default:
          return null;
      }
    };

    const fetchLeg = async (
      from: [number, number],
      to: [number, number],
      transport?: string
    ): Promise<[number, number][]> => {
      const profile = toProfile(transport);
      if (!token || !profile) {
        return greatCircle(from, to, 96);
      }

      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${token}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return greatCircle(from, to, 96);
        const json = await res.json();
        const coords: [number, number][] =
          json?.routes?.[0]?.geometry?.coordinates ?? [];
        return coords.length ? coords : greatCircle(from, to, 96);
      } catch {
        return greatCircle(from, to, 96);
      }
    };

    const build = async () => {
      if (itinerary.length < 2) {
        if (!cancelled)
          setRoutesGeoJSON({ type: "FeatureCollection", features: [] });
        return;
      }

      const legs = itinerary.slice(0, -1).map((d, i) => {
        const next = itinerary[i + 1];
        const transport = (d as Destination).transportToNext; // optional
        return { from: d, to: next, transport };
      });

      const coordsList = await Promise.all(
        legs.map((leg) =>
          fetchLeg(leg.from.coordinates, leg.to.coordinates, leg.transport)
        )
      );

      if (cancelled) return;

      const features = legs.map(
        (leg, i): Feature<LineString> => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coordsList[i] },
          properties: {
            fromId: leg.from.id,
            toId: leg.to.id,
            transport: leg.transport ?? "unknown",
          },
        })
      );

      setRoutesGeoJSON({ type: "FeatureCollection", features });
    };

    build();
    return () => {
      cancelled = true;
    };
  }, [itinerary, token, greatCircle]);

  const [popup, setPopup] = useState<{
    lngLat: [number, number];
    city: string;
    days: number;
    id: number;
  } | null>(null);

  type ClickEvent = {
    features?: GeoJSONFeature[];
    lngLat: { lng: number; lat: number };
  };

  const onMapClick = useCallback(
    (e: ClickEvent) => {
      const feature = e.features && e.features[0];
      if (feature && feature.properties) {
        const props = feature.properties as unknown as {
          id: string | number;
          city: string;
          days: string | number;
        };
        const id = Number(props.id);
        const city = String(props.city);
        const days = Number(props.days);
        onSelect?.(id);
        setPopup({ lngLat: [e.lngLat.lng, e.lngLat.lat], city, days, id });
      } else {
        setPopup(null);
      }
    },
    [onSelect]
  );

  // Track visited countries (ISO-2 codes, e.g., 'ES', 'FR')
  const [visitedIso2, setVisitedIso2] = useState<string[]>([]);

  // Resolve country ISO codes for each destination via Mapbox Geocoding (types=country)
  useEffect(() => {
    if (!token || itinerary.length === 0) {
      setVisitedIso2([]);
      return;
    }
    let cancelled = false;
    const fetchCountries = async () => {
      const codes = new Set<string>();
      for (const d of itinerary) {
        const [lng, lat] = d.coordinates;
        try {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&access_token=${token}`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const json = await res.json();
          const short: string | undefined =
            json?.features?.[0]?.properties?.short_code;
          if (short) {
            // short_code can be like 'gb' or 'gb-eng' -> take first segment and uppercase
            const iso2 = short.split("-")[0].toUpperCase();
            if (iso2.length === 2) codes.add(iso2);
          }
        } catch {
          // ignore individual failures
        }
        if (cancelled) return;
      }
      if (!cancelled) setVisitedIso2(Array.from(codes));
    };
    fetchCountries();
    return () => {
      cancelled = true;
    };
  }, [itinerary, token]);
  type FogOpts = {
    range?: [number, number];
    color?: string;
    "horizon-blend"?: number;
  };

  const handleMapLoad = useCallback((e: { target: MbMap }) => {
    // Ensure globe projection and add subtle atmosphere for contrast
    try {
      e.target.setProjection("globe");
      e.target.setFog({
        range: [0.5, 10],
        color: "rgba(255,255,255,0.25)",
        "horizon-blend": 0.2,
      } as FogOpts);
    } catch {}
  }, []);

  return (
    <div className="absolute inset-0" style={{ background: "#000020" }}>
      {token ? (
        <Map
          mapboxAccessToken={token}
          initialViewState={initialViewState}
          projection="globe"
          mapStyle="mapbox://styles/luisalberto2003/cmf34lq88002e01s21z3o2ep0"
          interactiveLayerIds={["points-circle"]}
          onClick={onMapClick}
          onLoad={handleMapLoad}
          dragRotate={false}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Visited countries highlight (beneath routes and points) */}
          <Source
            id="country-bounds"
            type="vector"
            url="mapbox://mapbox.country-boundaries-v1"
          >
            <Layer
              id="visited-countries-fill"
              type="fill"
              source-layer="country_boundaries"
              filter={[
                "any",
                ["in", ["get", "iso_3166_1"], ["literal", visitedIso2]],
                ["in", ["get", "iso_3166_1_alpha_2"], ["literal", visitedIso2]],
              ]}
              paint={{
                "fill-color": "#10B981",
                "fill-opacity": 0.16,
              }}
            />
            <Layer
              id="visited-countries-outline"
              type="line"
              source-layer="country_boundaries"
              filter={[
                "any",
                ["in", ["get", "iso_3166_1"], ["literal", visitedIso2]],
                ["in", ["get", "iso_3166_1_alpha_2"], ["literal", visitedIso2]],
              ]}
              layout={{ "line-join": "round" }}
              paint={{
                "line-color": "#10B981",
                "line-opacity": 0.35,
                "line-width": 1.0,
              }}
            />
          </Source>

          {/* Points */}
          <Source id="points" type="geojson" data={pointsGeoJSON}>
            {/* Subtle drop shadow */}
            <Layer
              id="points-shadow"
              type="circle"
              paint={{
                "circle-radius": ["case", ["get", "selected"], 13, 11],
                "circle-color": "#000000",
                "circle-opacity": 0.12,
                "circle-blur": 0.4,
                "circle-translate": [0, 1],
                "circle-translate-anchor": "viewport",
              }}
            />
            {/* Soft glow underlay */}
            <Layer
              id="points-glow"
              type="circle"
              paint={{
                "circle-radius": ["case", ["get", "selected"], 16, 14],
                "circle-color": "#10B981",
                "circle-opacity": 0.1,
              }}
            />
            {/* White badge with green ring (click target) */}
            <Layer
              id="points-circle"
              type="circle"
              paint={{
                "circle-radius": ["case", ["get", "selected"], 12, 10],
                "circle-color": "#ffffff",
                "circle-stroke-color": [
                  "case",
                  ["get", "selected"],
                  "#10B981" /* emerald-500 when selected */,
                  "#E5E7EB" /* neutral-200 otherwise */,
                ],
                "circle-stroke-width": ["case", ["get", "selected"], 2.5, 1.5],
              }}
            />
            {/* Numeric order labels */}
            <Layer
              id="points-labels"
              type="symbol"
              layout={{
                "text-field": ["to-string", ["get", "order"]],
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-size": 12,
                "text-offset": [0, 0],
                "text-anchor": "center",
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              }}
              paint={{
                "text-color": "#10B981",
                "text-halo-color": "#ffffff",
                "text-halo-width": 2,
                "text-halo-blur": 0.6,
              }}
            />
          </Source>

          {/* Great-circle arcs between consecutive points */}
          <Source id="arcs" type="geojson" data={routesGeoJSON}>
            {/* Solid arcs for defined transport (color by transport) */}
            <Layer
              id="arcs-line-transport"
              type="line"
              filter={[
                "all",
                ["has", "transport"],
                ["!=", ["get", "transport"], "unknown"],
              ]}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
              paint={{
                "line-color": [
                  "match",
                  ["get", "transport"],
                  "car",
                  "#ff2a6d",
                  "walk",
                  "#16a34a",
                  "bike",
                  "#0ea5e9",
                  "train",
                  "#8b5cf6",
                  "plane",
                  "#f59e0b",
                  "#ff2a6d",
                ],
                "line-width": 2.75,
                "line-opacity": 0.95,
              }}
            />

            {/* Dotted arcs for unknown transport (rendered above solid to ensure visibility) */}
            <Layer
              id="arcs-line"
              type="line"
              filter={["==", ["get", "transport"], "unknown"]}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
              paint={{
                "line-color": "#4b5563", // gray-600 darker dotted line
                "line-width": 2.75,
                "line-opacity": 0.95,
                // Zoom-aware dotted pattern; small round dashes read as dots
                "line-dasharray": [
                  "step",
                  ["zoom"],
                  ["literal", [0.25, 2.4]],
                  6,
                  ["literal", [0.35, 2.6]],
                  10,
                  ["literal", [0.5, 3.0]],
                ],
              }}
            />
          </Source>

          {popup && (
            <Popup
              longitude={popup.lngLat[0]}
              latitude={popup.lngLat[1]}
              anchor="bottom-left"
              closeOnClick={false}
              onClose={() => setPopup(null)}
              offset={8}
              className="!p-0 !bg-transparent !shadow-none"
            >
              <div className="rounded bg-black/80 text-white text-xs shadow p-2">
                <div className="font-semibold">{popup.city}</div>
                <div className="text-neutral-300">Days: {popup.days}</div>
              </div>
            </Popup>
          )}
        </Map>
      ) : (
        <div className="w-full h-full grid place-items-center text-sm text-neutral-300 p-4">
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment to display the
          map.
        </div>
      )}
    </div>
  );
}
