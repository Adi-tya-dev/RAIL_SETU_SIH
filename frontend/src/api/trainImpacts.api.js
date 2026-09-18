import { getSchedule, listSchedules } from "./schedules.api";

export async function listTrainImpacts(params = {}) {
  const schedules = await listSchedules(params);
  const plans = schedules?.data || [];
  const details = await Promise.all(plans.map(async (plan) => {
    try {
      const response = await getSchedule(plan.plan_id);
      return { plan, detail: response?.data };
    } catch {
      return null;
    }
  }));

  const impacts = details.flatMap((entry) =>
    (entry?.detail?.train_impacts || []).map((impact) => ({
      ...impact,
      plan_id: entry.plan.plan_id,
      plan: entry.detail.plan || entry.plan,
    }))
  );

  return { data: impacts, pagination: schedules?.pagination, planCount: plans.length };
}