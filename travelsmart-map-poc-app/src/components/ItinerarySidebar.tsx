"use client";

import React from "react";

export type Destination = {
  id: number;
  city: string;
  coordinates: [number, number]; // [lng, lat]
  days: number;
};

type Props = {
  itinerary: Destination[];
  selectedId?: number | null;
  onChangeDays: (id: number, days: number) => void;
  onAddDestination: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSelect?: (id: number) => void;
};

export default function ItinerarySidebar({
  itinerary,
  selectedId,
  onChangeDays,
  onAddDestination,
  onReorder,
  onSelect,
}: Props) {
  // Drag and drop handlers using native HTML5 DnD
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    e.dataTransfer.setData("text/plain", String(index));
    // optional drag image tweak
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Needed to allow dropping
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    dropIndex: number
  ) => {
    e.preventDefault();
    const fromIndexStr = e.dataTransfer.getData("text/plain");
    const fromIndex = Number(fromIndexStr);
    if (!Number.isNaN(fromIndex) && fromIndex !== dropIndex) {
      onReorder?.(fromIndex, dropIndex);
    }
  };

  return (
    <aside className="h-full flex flex-col border-r border-neutral-800 bg-[--background]">
      <div className="px-4 py-3 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">Your itinerary</h2>
        <p className="text-sm text-neutral-500">
          Reorder, adjust days, and add destinations
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        {itinerary.length === 0 ? (
          <div className="p-4 text-sm text-neutral-500">
            No destinations yet. Add your first one below.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {itinerary.map((d, index) => {
              const isSelected = d.id === selectedId;
              return (
                <li key={d.id}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 select-none ${
                      isSelected
                        ? "bg-neutral-900/50"
                        : "hover:bg-neutral-900/30"
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    {/* Order badge */}
                    <button
                      className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-semibold ${
                        isSelected
                          ? "bg-sky-500 text-white"
                          : "bg-neutral-800 text-neutral-200"
                      }`}
                      title={`Stop #${index + 1}`}
                      onClick={() => onSelect?.(d.id)}
                    >
                      {index + 1}
                    </button>

                    {/* City and meta */}
                    <div className="flex-1 min-w-0">
                      <button
                        className={`text-left truncate ${
                          isSelected ? "text-white" : "text-neutral-200"
                        }`}
                        onClick={() => onSelect?.(d.id)}
                        title={d.city}
                      >
                        {d.city}
                      </button>
                      <div className="text-xs text-neutral-500">
                        {d.coordinates[1].toFixed(2)},{" "}
                        {d.coordinates[0].toFixed(2)}
                      </div>
                    </div>

                    {/* Days control */}
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
                        onClick={() =>
                          onChangeDays(d.id, Math.max(1, d.days - 1))
                        }
                        aria-label={`Decrease days for ${d.city}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={d.days}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!Number.isNaN(val) && val >= 1)
                            onChangeDays(d.id, val);
                        }}
                        className="w-14 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-center"
                        aria-label={`Days in ${d.city}`}
                      />
                      <button
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
                        onClick={() => onChangeDays(d.id, d.days + 1)}
                        aria-label={`Increase days for ${d.city}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-4 border-t border-neutral-800">
        <button
          className="w-full px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
          onClick={onAddDestination}
        >
          + Add destination
        </button>
      </div>
    </aside>
  );
}
