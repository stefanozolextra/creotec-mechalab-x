type AdminFeedLikeItem = {
  type: string;
  batch_code: string | null;
  message: string;
};

export const formatAdminFeedTime = (value: string): string => {
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return "Unknown time";
  return asDate.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const toAdminFeedText = (item: AdminFeedLikeItem): string => {
  const batchLabel = item.batch_code ? `[${item.batch_code}] ` : "";
  return `${batchLabel}${item.message}`;
};

export const toAdminFeedTypeLabel = (type: string): string => {
  if (type === "system_reset") return "System Reset";
  if (type === "trainee_created") return "Trainee Created";
  if (type === "simulation_progress") return "Simulation Progress";
  if (type === "simulation_completed") return "Simulation Completed";
  return "Batch Export";
};
