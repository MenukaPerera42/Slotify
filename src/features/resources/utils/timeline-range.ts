export interface BlockingInterval {
  resourceId: string;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
}

export function selectFreeTimelineRange(
  resourceId: string,
  anchorIndex: number,
  targetIndex: number,
  timelineStartMs: number,
  timelineEndMs: number,
  slotMinutes: number,
  occupancy: BlockingInterval[]
): { startIndex: number; endIndex: number; startMs: number; endMs: number } | null {
  const stepMs = slotMinutes * 60_000;
  if (!Number.isInteger(anchorIndex) || !Number.isInteger(targetIndex) || stepMs <= 0) return null;
  const startIndex = Math.min(anchorIndex, targetIndex);
  const endIndex = Math.max(anchorIndex, targetIndex) + 1;
  const startMs = timelineStartMs + startIndex * stepMs;
  const endMs = timelineStartMs + endIndex * stepMs;
  if (startIndex < 0 || startMs < timelineStartMs || endMs > timelineEndMs) return null;
  if (occupancy.some((item) =>
    item.resourceId === resourceId &&
    (item.status === "PENDING" || item.status === "APPROVED") &&
    new Date(item.startTime).getTime() < endMs &&
    new Date(item.endTime).getTime() > startMs
  )) return null;
  return { startIndex, endIndex, startMs, endMs };
}
