import { useCallback, useEffect, useRef, useState } from "react";

export function useApi() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (promiseFactory) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await promiseFactory();
      if (mounted.current && id === requestId.current) setData(result);
      return result;
    } catch (err) {
      if (err && err.name === "AbortError") return undefined;
      if (mounted.current && id === requestId.current) setError(err);
      return undefined;
    } finally {
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, run, reset, setData };
}

export function useApiQuery(fetcher, deps = [], { immediate = true } = {}) {
  const { data, loading, error, run, setData } = useApi();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(() => run(() => fetcherRef.current()), [run]);

  useEffect(() => {
    if (immediate) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload, setData };
}