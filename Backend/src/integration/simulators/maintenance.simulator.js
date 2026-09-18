const { MODE, DISCLAIMER } = require("../config");
const { loadReference } = require("./reference");

const MAINTENANCE_STATUSES = ["PENDING", "APPROVED", "IN_PROGRESS", "COMPLETED"];

// Factory that turns a catalogue of maintenance request specs into a source
// system "live" payload. Specs whose asset does not exist in the reference
// catalogue are skipped so import never orphans data.
function createMaintenanceSimulator({ system, systemName, department, catalog }) {
  async function getData() {
    const ref = await loadReference();
    const tasks = [];

    for (let i = 0; i < catalog.length; i += 1) {
      const spec = catalog[i];
      const asset = ref.assetByCode.get(spec.assetCode);
      if (!asset) continue;

      const block = spec.blockCode ? ref.blockByCode.get(spec.blockCode) : null;
      const section = spec.sectionCode
        ? ref.sectionByCode.get(spec.sectionCode)
        : null;

      tasks.push({
        request_id: spec.externalRef,
        work_order: `${system}/WO/${department}/${String(i + 1).padStart(3, "0")}`,
        category: spec.category,
        maintenance_type: spec.maintenanceType,
        department,
        asset_code: asset.asset_code,
        asset_name: asset.asset_name,
        block_code: block ? block.block_code : null,
        section_code: (section && section.section_code) || (block && block.track.section.section_code) || null,
        description: spec.description,
        priority: spec.priority,
        criticality: spec.criticality,
        urgency: spec.urgency,
        duration_minutes: spec.durationMinutes,
        requested_at: spec.requestedAt,
        preferred_start: spec.preferredStart || null,
        deadline: spec.deadline || null,
        status: spec.status,
        overdue: spec.overdue || false,
      });
    }

    return {
      system,
      system_name: systemName,
      department,
      mode: MODE,
      disclaimer: DISCLAIMER,
      generated_at: new Date().toISOString(),
      record_count: tasks.length,
      tasks,
    };
  }

  return { getData };
}

module.exports = { createMaintenanceSimulator, MAINTENANCE_STATUSES };