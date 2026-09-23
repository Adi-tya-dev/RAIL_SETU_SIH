import { apiRequest } from "./client";
import { getSchedule, listSchedules } from "./schedules.api";

export async function listTrainImpacts(params = {}) {
  try {
    const res = await apiRequest("/train-impacts", { query: params });
    if (res?.data) {
      return {
        data: res.data,
        pagination: res.pagination,
        planCount: res.planCount ?? res.data.length,
      };
    }
  } catch (err) {
    // If endpoint is not available, fallback to derivation from schedules
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

    const impacts = details.flatMap((entry) =>
      (entry?.detail?.train_impacts || []).map((impact) => ({
        ...impact,
        plan_id: entry.plan.plan_id,
        plan: entry.detail.plan || entry.plan,
        block: entry.detail?.plan?.block || entry.plan.block,
      }))
    );

    return { data: impacts, pagination: schedules?.pagination, planCount: plans.length };
  } catch {
    return { data: [], pagination: {}, planCount: 0 };
  }
}