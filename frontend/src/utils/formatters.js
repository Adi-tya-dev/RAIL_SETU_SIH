export function humanize(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

export function formatScore(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export function asBool(value) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return Boolean(value);
}

export function toLocalInputValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromLocalInputValue(value) {
  return value ? new Date(value).toISOString() : null;
}

export function todayPlusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function toDateTimeLocalValue(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRelativeTime(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);

  if (diffSec < 45 && diffSec >= 0) return "Just now";
  if (diffSec < 3600 && diffSec >= 0) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}m ago`;
  }
  if (diffSec < 86400 && diffSec >= 0) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago`;
  }
  return formatDateTime(d);
}

export function getDeadlineCompliance(task) {
  if (!task) return { tone: "gray", label: "No Deadline", isCompleted: false, onTime: null };
  const status = String(task.status || "PENDING").toUpperCase();
  const isCompleted = status === "COMPLETED";
  const isInProgress = status === "IN_PROGRESS";
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const completedAt = task.completed_at ? new Date(task.completed_at) : null;
  const now = new Date();

  if (isCompleted) {
    if (!deadline) {
      return { tone: "green", label: "Completed", isCompleted: true, onTime: true };
    }
    const finishedTime = completedAt || now;
    const diffMin = Math.round((deadline.getTime() - finishedTime.getTime()) / 60000);
    if (diffMin >= 0) {
      return {
        tone: "green",
        label: "Completed in Deadline",
        badgeText: "On-Time ✅",
        subtext: diffMin > 0 ? `${formatDuration(diffMin)} before deadline` : "At deadline",
        isCompleted: true,
        onTime: true,
      };
    } else {
      return {
        tone: "red",
        label: "Completed Overdue",
        badgeText: "Delayed ⚠️",
        subtext: `Breached by ${formatDuration(Math.abs(diffMin))}`,
        isCompleted: true,
        onTime: false,
      };
    }
  }

  if (!deadline) {
    return { tone: "gray", label: "No deadline", isCompleted: false, onTime: null };
  }

  const diffMin = Math.round((deadline.getTime() - now.getTime()) / 60000);
  if (diffMin < 0) {
    return {
      tone: "red",
      label: "Deadline Breached",
      badgeText: "Overdue 🚨",
      subtext: `Past due by ${formatDuration(Math.abs(diffMin))}`,
      isCompleted: false,
      isOverdue: true,
    };
  }

  if (isInProgress) {
    return {
      tone: "blue",
      label: "In Execution (Invoked)",
      badgeText: "Invoked ⚡",
      subtext: `${formatDuration(diffMin)} left`,
      isCompleted: false,
      isInProgress: true,
    };
  }

  if (diffMin <= 120) {
    return {
      tone: "amber",
      label: "Approaching Deadline",
      badgeText: "Urgent ⚠️",
      subtext: `${formatDuration(diffMin)} remaining`,
      isCompleted: false,
    };
  }

  return {
    tone: "gray",
    label: "Within Window",
    badgeText: `${formatDuration(diffMin)} left`,
    subtext: `Due ${formatTime(deadline)}`,
    isCompleted: false,
  };
}