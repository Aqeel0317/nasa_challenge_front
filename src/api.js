// Thin wrapper around the FastAPI backend.
const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* response was not JSON */
    }
    throw new Error(detail);
  }
  return res.json();
}

export const getCrops = () => request("/api/crops");

export const getRotations = (payload) =>
  request("/api/rotations", { method: "POST", body: JSON.stringify(payload) });

export const simulateFarm = (payload) =>
  request("/api/farm/simulate", { method: "POST", body: JSON.stringify(payload) });
