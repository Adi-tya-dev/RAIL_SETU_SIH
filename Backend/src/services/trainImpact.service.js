const prisma = require("../config/prisma");
const seedData = require("./seedData.provider");
const { parsePagination, optionalString } = require("../utils/validation.util");

async function findAll(query = {}) {
  const { page, limit, skip, take } = parsePagination(query, { fallbackLimit: 100, maxLimit: 500 });
  const where = {};

  const impactType = optionalString(query.impact_type);
  if (impactType) where.impact_type = impactType;

  try {
    const [total, impacts] = await Promise.all([
      prisma.planTrainImpact.count({ where }),
      prisma.planTrainImpact.findMany({
        where,
        skip,
        take,
        orderBy: [{ estimated_delay_minutes: "desc" }, { impact_id: "asc" }],
        include: {
          train: {
            include: {
              origin_station: true,
              destination_station: true,
            },
          },
          plan: {
            include: {
              block: {
                include: {
                  track: {
                    include: {
                      section: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (impacts.length > 0) {
      // Deduplicate by train and block to ensure diverse, unique operational records
      const seen = new Set();
      const uniqueFormatted = [];
      for (const item of impacts) {
        const blockCode = item.plan?.block?.block_code || item.block?.block_code || String(item.plan?.block_id || "");
        const trainId = String(item.train_id || item.train?.train_number || "");
        const key = `${trainId}_${blockCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFormatted.push({
            impact_id: String(item.impact_id),
            plan_id: String(item.plan_id),
            train_id: item.train_id ? String(item.train_id) : null,
            impact_type: item.impact_type,
            estimated_delay_minutes: Number(item.estimated_delay_minutes || 0),
            train: item.train,
            plan: item.plan,
            block: item.plan?.block || null,
          });
        }
      }

      const total = uniqueFormatted.length;
      const paged = uniqueFormatted.slice(skip, skip + take);

      return {
        data: paged,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        planCount: total,
      };
    }
  } catch (err) {
    // Database offline or query error, fall back to seed data
  }

  // Fallback to seed data when DB has no impacts (e.g. freshly generated conflict-free plans)
  const seedImpacts = seedData.blockPlans.flatMap((plan) =>
    (plan.plan_train_impacts || []).map((impact) => ({
      impact_id: String(impact.impact_id),
      plan_id: String(plan.plan_id),
      train_id: impact.train_id ? String(impact.train_id) : null,
      impact_type: impact.impact_type,
      estimated_delay_minutes: Number(impact.delay_minutes ?? impact.estimated_delay_minutes ?? 0),
      train: impact.train,
      plan,
      block: plan.block || null,
    }))
  );

  const filtered = impactType
    ? seedImpacts.filter((i) => i.impact_type && i.impact_type.toUpperCase() === impactType.toUpperCase())
    : seedImpacts;

  const seenSeed = new Set();
  const uniqueSeed = [];
  for (const item of filtered) {
    const blockCode = item.block?.block_code || item.plan?.block?.block_code || "";
    const trainId = String(item.train_id || item.train?.train_number || "");
    const key = `${trainId}_${blockCode}`;
    if (!seenSeed.has(key)) {
      seenSeed.add(key);
      uniqueSeed.push(item);
    }
  }

  const total = uniqueSeed.length;
  const paged = uniqueSeed.slice(skip, skip + take);

  return {
    data: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    planCount: total,
  };
}

module.exports = { findAll };
