import { useMemo } from "react";
import { listBlocks } from "../api/blocks.api";
import { useApiQuery } from "./useApi";

export function useReferenceData() {
  const { data, loading, error, reload } = useApiQuery(() => listBlocks({ limit: 100 }), []);

  const blocks = useMemo(
    () =>
      (data?.data || []).map((b) => ({
        id: String(b.block_id),
        code: b.block_code,
      })),
    [data]
  );

  const sections = useMemo(() => {
    const map = new Map();
    (data?.data || []).forEach((b) => {
      const s = b.track?.section;
      if (s) {
        map.set(String(s.section_id), {
          id: String(s.section_id),
          code: s.section_code,
          name: s.section_name,
        });
      }
    });
    return Array.from(map.values());
  }, [data]);

  return { blocks, sections, loading, error, reload };
}