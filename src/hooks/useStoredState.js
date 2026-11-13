import { useEffect, useState } from "react";

// useState that survives a page refresh. Falls back to plain state if storage is blocked.
export default function useStoredState(key, initial, storage = "local") {
  const store = () => (storage === "session" ? window.sessionStorage : window.localStorage);
  const [value, setValue] = useState(() => {
    try {
      const raw = store().getItem(key);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      if (value == null) store().removeItem(key);
      else store().setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, [key, value]);
  return [value, setValue];
}
