import { DtrStorageItem, getDtrStorage, saveDtrStorage, setCachedPdfDataUrl } from "@/data/dtrStorage";

export type DtrRealtimeEvent =
  | { type: "INSERT"; record: DtrStorageItem; id: string }
  | { type: "UPDATE"; record: DtrStorageItem; id: string }
  | { type: "DELETE"; id: string; record?: never }
  | { type: "CONNECTED"; timestamp?: string; id?: never; record?: never };

type RealtimeCallback = (event: DtrRealtimeEvent) => void;

const listeners = new Set<RealtimeCallback>();
let eventSource: EventSource | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let reconnectTimeout: any = null;

// Initialize BroadcastChannel for instant same-browser cross-tab messaging
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("dict_dtr_realtime_channel");
    broadcastChannel.onmessage = (e) => {
      const data: DtrRealtimeEvent = e.data;
      if (data && data.type) {
        handleIncomingRealtimeEvent(data, false);
      }
    };
  }
} catch (e) {
  console.warn("BroadcastChannel not supported in this environment:", e);
}

function handleIncomingRealtimeEvent(event: DtrRealtimeEvent, broadcastLocally = true) {
  if (event.type === "CONNECTED") return;

  // Broadcast to other tabs of the same browser
  if (broadcastLocally && broadcastChannel) {
    try {
      broadcastChannel.postMessage(event);
    } catch {}
  }

  // Update local storage synchronously so cache matches real-time event
  const current = getDtrStorage();

  if (event.type === "INSERT" && event.record) {
    if (event.record.pdfDataUrl) {
      setCachedPdfDataUrl(event.record.id, event.record.pdfDataUrl);
    }
    const updated = [event.record, ...current.filter((r) => r.id !== event.record.id)];
    saveDtrStorage(updated);
  } else if (event.type === "UPDATE" && event.record) {
    if (event.record.pdfDataUrl) {
      setCachedPdfDataUrl(event.record.id, event.record.pdfDataUrl);
    }
    const updated = current.map((r) => (r.id === event.record.id ? { ...r, ...event.record } : r));
    saveDtrStorage(updated);
  } else if (event.type === "DELETE" && event.id) {
    const updated = current.filter((r) => r.id !== event.id);
    saveDtrStorage(updated);
  }

  // Dispatch custom event for sub-module badge counts
  window.dispatchEvent(new CustomEvent("dict_dtr_storage_updated", { detail: event }));

  // Notify all active component listeners (e.g. DtrStorageView, DtrGenerator)
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error("Error in realtime DTR listener:", err);
    }
  });
}

function initEventSource() {
  if (typeof window === "undefined") return;
  if (eventSource) return;

  try {
    eventSource = new EventSource("/api/dtr-storage/events");

    eventSource.onmessage = (event) => {
      try {
        const data: DtrRealtimeEvent = JSON.parse(event.data);
        handleIncomingRealtimeEvent(data, true);
      } catch (e) {
        // Heartbeat or ping comment
      }
    };

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(initEventSource, 3000);
    };
  } catch (e) {
    console.warn("Failed to initialize DTR SSE EventSource:", e);
  }
}

/**
 * Broadcasts a local client event to same-browser tabs immediately
 */
export function broadcastLocalDtrEvent(event: DtrRealtimeEvent) {
  handleIncomingRealtimeEvent(event, true);
}

/**
 * Subscribe to real-time INSERT, UPDATE, and DELETE DTR events.
 * Automatically initializes SSE connection and cleans up on unsubscribe.
 */
export function subscribeToDtrRealtime(callback: RealtimeCallback): () => void {
  listeners.add(callback);
  initEventSource();

  return () => {
    listeners.delete(callback);
    // If no active listeners remain, cleanly close SSE to avoid leaking resources
    if (listeners.size === 0 && eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}
