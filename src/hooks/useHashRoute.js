import { useCallback, useEffect, useState } from "react";

// Tiny hash router: #/plans, #/setup/2 ... Browser back/forward and bookmarks work
// without a routing library or any server configuration.
const read = () => window.location.hash.replace(/^#\/?/, "") || "home";

export default function useHashRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      document.getElementById("main")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  // replace: swap the current history entry (used by the loading page, so the
  // browser's back button never returns to it).
  const go = useCallback((to, { replace = false } = {}) => {
    if (replace) window.location.replace(`#/${to}`);
    else window.location.hash = `/${to}`;
  }, []);
  const [page, sub] = route.split("/");
  return { page, sub, go };
}
