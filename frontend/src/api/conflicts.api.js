import { apiRequest } from "./client";
import { getSchedule, listSchedules } from "./schedules.api";

export async function listConflicts(params = {}) {
  try {
    const res = await apiRequest("/conflicts", { query: params });
    if (res?.data) {
      return {
        data: res.data,
        pagination: res.pagination,
        planCount: res.pagination?.total ?? res.data.length,
      };
    }
  } catch (err) {
    // If /api/conflicts is not available, fallback to derivation from schedules
  }

  // Fallback: derive from schedules if direct endpoint fails
  try {
    const schedules = await listSchedules({ limit: 100 });
    const plans = schedules?.data || [];
    const details = await Promise.all(
      plans.map(async (plan) => {
        try {
          const response = await getSchedule(plan.plan_id);
          return { plan, detail: response?.data };
        } catch {
          return null;
        }
      })
    );

    const conflicts = details.flatMap((entry) =>
      (entry?.detail?.conflicts || []).map((conflict) => ({
        ...conflict,
        plan_id: entry.plan.plan_id,
        block: entry.detail.plan?.block || entry.plan.block,
      }))
    );

    return { data: conflicts, pagination: schedules?.pagination, planCount: plans.length };
  } catch {
    return { data: [], pagination: {}, planCount: 0 };
  }
}

/**
 * Trigger backend conflict detection (POST /api/conflicts/detect)
 * Idempotent — backend skips if conflicts already exist unless force=true
 */
export async function detectConflicts(force = false) {
  try {
    const res = await apiRequest("/conflicts/detect", {
      method: "POST",
      body: { force },
    });
    return res;
  } catch (err) {
    return { success: false, error: err?.message || "Detection failed" };
  }
}