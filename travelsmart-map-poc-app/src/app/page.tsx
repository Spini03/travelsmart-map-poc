"use client";

import React, { useMemo, useState } from "react";
import MapComponent from "@/components/Map";
import ItinerarySidebar, {
  type Destination,
} from "@/components/ItinerarySidebar";

export default function Home() {
  const initialItinerary = useMemo<Destination[]>(
    () => [
      { id: 1, city: "Madrid", coordinates: [-3.7038, 40.4168], days: 2 },
      { id: 2, city: "París", coordinates: [2.3522, 48.8566], days: 3 },
      { id: 3, city: "Ámsterdam", coordinates: [4.8952, 52.3702], days: 2 },
      { id: 4, city: "Roma", coordinates: [12.4964, 41.9028], days: 4 },
    ],
    []
  );

  const [itinerary, setItinerary] = useState<Destination[]>(initialItinerary);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleChangeDays = (id: number, days: number) => {
    setItinerary((prev) => prev.map((d) => (d.id === id ? { ...d, days } : d)));
  };

  const handleAddDestination = () => {
    // Simple placeholder: add Barcelona after last
    const nextId = (itinerary.at(-1)?.id ?? 0) + 1;
    const newDestination: Destination = {
      id: nextId,
      city: "Barcelona",
      coordinates: [2.1734, 41.3851],
      days: 2,
    };
    setItinerary((prev) => [...prev, newDestination]);
    setSelectedId(nextId);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    setItinerary((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleSelect = (id: number) => setSelectedId(id);
  const handleClearSelection = () => setSelectedId(null);

  return (
    <main className="h-[100dvh] grid grid-cols-[360px_1fr]">
      <ItinerarySidebar
        itinerary={itinerary}
        selectedId={selectedId}
        onChangeDays={handleChangeDays}
        onAddDestination={handleAddDestination}
        onReorder={handleReorder}
        onSelect={handleSelect}
      />
      <div className="relative">
        <MapComponent
          itinerary={itinerary}
          selectedId={selectedId}
          onSelect={handleSelect}
          onClearSelection={handleClearSelection}
        />
      </div>
    </main>
  );
}
