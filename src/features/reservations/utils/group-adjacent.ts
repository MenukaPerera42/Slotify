export type GroupableReservation = {
  id: string;
  resourceId: string;
  departmentId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  startTime: Date;
  endTime: Date;
};

export type ReservationGroup = {
  resourceId: string;
  departmentId: string | null;
  status: "PENDING" | "APPROVED";
  startTime: Date;
  endTime: Date;
  reservationIds: string[];
};

// Pure visual grouping. Source rows and their individual ownership are never changed.
export function groupAdjacentReservations(items: GroupableReservation[]): ReservationGroup[] {
  const sorted = items.filter((item) => item.status === "PENDING" || item.status === "APPROVED")
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId)
      || (a.departmentId ?? "").localeCompare(b.departmentId ?? "")
      || a.status.localeCompare(b.status)
      || a.startTime.getTime() - b.startTime.getTime()
      || a.id.localeCompare(b.id));
  const groups: ReservationGroup[] = [];
  for (const item of sorted) {
    const last = groups.at(-1);
    if (last && item.departmentId && last.departmentId === item.departmentId
      && last.resourceId === item.resourceId && last.status === item.status
      && last.endTime.getTime() === item.startTime.getTime()) {
      last.endTime = item.endTime;
      last.reservationIds.push(item.id);
    } else {
      groups.push({ resourceId: item.resourceId, departmentId: item.departmentId,
        status: item.status as "PENDING" | "APPROVED", startTime: item.startTime,
        endTime: item.endTime, reservationIds: [item.id] });
    }
  }
  return groups;
}
