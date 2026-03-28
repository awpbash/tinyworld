import type { Person, GraphData, SSEEvent, ConnectionSSEEvent } from "./types";

const BASE = "/api";

/* ── Stream: search person (SSE via GET) ────────────── */
export function searchPersonStream(
  query: string,
  onEvent: (ev: SSEEvent) => void,
  onDone?: () => void
): () => void {
  const url = `${BASE}/search/stream?q=${encodeURIComponent(query)}`;
  const eventSource = new EventSource(url);

  const handle = (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
  };

  eventSource.addEventListener("status", handle);
  eventSource.addEventListener("result", handle);
  eventSource.addEventListener("browser_url", handle);
  eventSource.addEventListener("graph_update", handle);
  eventSource.addEventListener("complete", (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
    eventSource.close();
    onDone?.();
  });
  eventSource.addEventListener("error", (e: any) => {
    if (e.data) {
      try {
        onEvent(JSON.parse(e.data));
      } catch {}
    }
    eventSource.close();
    onDone?.();
  });

  eventSource.onerror = () => {
    eventSource.close();
    onDone?.();
  };

  return () => eventSource.close();
}

/* ── Stream: find connection (SSE via GET) ──────────── */
export function findConnectionStream(
  personAId: number,
  personBId: number,
  onEvent: (ev: ConnectionSSEEvent) => void,
  onDone?: () => void
): () => void {
  const url = `${BASE}/connections/stream?person_a_id=${personAId}&person_b_id=${personBId}`;
  const eventSource = new EventSource(url);

  const handle = (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
  };

  eventSource.addEventListener("status", handle);
  eventSource.addEventListener("result", handle);
  eventSource.addEventListener("path_found", handle);
  eventSource.addEventListener("graph_update", handle);
  eventSource.addEventListener("complete", (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
    eventSource.close();
    onDone?.();
  });
  eventSource.addEventListener("error", (e: any) => {
    if (e.data) {
      try {
        onEvent(JSON.parse(e.data));
      } catch {}
    }
    eventSource.close();
    onDone?.();
  });

  eventSource.onerror = () => {
    eventSource.close();
    onDone?.();
  };

  return () => eventSource.close();
}

/* ── REST endpoints ─────────────────────────────────── */
export async function getPersonProfile(id: number): Promise<Person> {
  const res = await fetch(`${BASE}/persons/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch person ${id}`);
  return res.json();
}

export async function getGraph(): Promise<GraphData> {
  const res = await fetch(`${BASE}/graph`);
  if (!res.ok) throw new Error("Failed to fetch graph");
  return res.json();
}

export async function getPersonNetwork(id: number): Promise<GraphData> {
  const res = await fetch(`${BASE}/person/${id}/network`);
  if (!res.ok) throw new Error(`Failed to fetch network for person ${id}`);
  return res.json();
}

export async function listPersons(): Promise<Person[]> {
  const res = await fetch(`${BASE}/persons`);
  if (!res.ok) throw new Error("Failed to fetch persons");
  return res.json();
}
