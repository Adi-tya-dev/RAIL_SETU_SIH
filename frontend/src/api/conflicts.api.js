import { getSchedule, listSchedules } from "./schedules.api";

export async function listConflicts(params = {}) {
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

  const conflicts = details.flatMap((entry) =>
    (entry?.detail?.conflicts || []).map((conflict) => ({
      ...conflict,
      plan_id: entry.plan.plan_id,
      block: entry.detail.plan?.block || entry.plan.block,
    }))
  );

  return { data: conflicts, pagination: schedules?.pagination, planCount: plans.length };
}