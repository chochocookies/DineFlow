"use client";

import { useEffect, useState } from "react";
import { ChefHat } from "lucide-react";
import type { Order } from "@/lib/types";

// Kitchen cooks a table's items in parallel, not one after another, so the
// customer waits for the SLOWEST item — hence max(), not a sum across
// items. Falls back to 15 (matching menu.DefaultPrepTimeMinutes on the
// backend) only for the unlikely case every item is somehow missing a
// prep time.
function estimatedMinutes(order: Order): number {
  const times = order.items.map((i) => i.prep_time_minutes ?? 0).filter((t) => t > 0);
  return times.length > 0 ? Math.max(...times) : 15;
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// order-tracker.tsx only mounts this while status === "preparing", so
// preparing_started_at should always be set by then (see
// order.Repository.UpdateStatus on the backend) — Date.now() is just a
// defensive fallback, not the expected path.
export function CookingCountdown({ order }: { order: Order }) {
  const totalSeconds = estimatedMinutes(order) * 60;

  // Computed once via a lazy useState initializer rather than inline in the
  // render body — Date.now() is impure, so evaluating it directly on every
  // render (in the fallback branch, when preparing_started_at is somehow
  // unset) would silently shift the countdown's baseline each time instead
  // of anchoring it once at mount.
  const [startedAt] = useState(() =>
    order.preparing_started_at
      ? new Date(order.preparing_started_at).getTime()
      : Date.now(),
  );

  const secondsLeft = () =>
    Math.max(0, totalSeconds - Math.floor((Date.now() - startedAt) / 1000));

  const [remaining, setRemaining] = useState(secondsLeft);

  // Recomputed from wall-clock time on every tick rather than decremented
  // by hand, so it stays correct even after the tab was backgrounded or
  // throttled instead of drifting.
  useEffect(() => {
    const id = setInterval(() => setRemaining(secondsLeft()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeconds, startedAt]);

  const done = remaining <= 0;

  return (
    <div className="animate-in flex items-center gap-3 rounded-2xl border border-secondary/30 bg-secondary-tint px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
        <ChefHat size={20} />
      </div>
      <div>
        <p className="text-sm font-medium text-ink">
          {done ? "Sebentar lagi selesai…" : "Estimasi waktu masak"}
        </p>
        {!done && (
          <p className="font-data text-lg font-semibold text-secondary">
            {formatCountdown(remaining)}
          </p>
        )}
      </div>
    </div>
  );
}
