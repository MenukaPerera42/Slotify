import assert from "node:assert/strict";
import { bookedTimelineResources, proposeTimelineDrag, dragOverlapsBooking, applyConfirmedTime } from "../src/features/resources/utils/timeline-interactions.ts";

const start = Date.parse("2026-10-20T02:30:00.000Z");
const end = start + 10 * 60 * 60_000;
const at = (slots) => new Date(start + slots * 30 * 60_000).toISOString();
const resources = [{ id: "room" }, { id: "desk" }, { id: "lab" }];
const occupancy = [
  { id: "own", resourceId: "room", status: "APPROVED", startTime: at(4), endTime: at(6), updatedAt: at(0) },
  { id: "next", resourceId: "room", status: "PENDING", startTime: at(8), endTime: at(10) },
  { id: "old", resourceId: "desk", status: "APPROVED", startTime: at(-4), endTime: at(0) },
  { id: "cancelled", resourceId: "lab", status: "CANCELLED", startTime: at(4), endTime: at(6) },
];
assert.deepEqual(bookedTimelineResources(resources, occupancy, start, end).map((item) => item.id), ["room"]);
assert.deepEqual(bookedTimelineResources(resources, occupancy.slice(2), start, end), []);
assert.deepEqual(bookedTimelineResources(resources, [{ ...occupancy[0], resourceId: "desk" }], start, end).map((item) => item.id), ["desk"]);

const drag = (mode, deltaX, overrides = {}) => proposeTimelineDrag({
  mode, initialStartMs: Date.parse(at(4)), initialEndMs: Date.parse(at(6)),
  deltaX, containerWidth: 1000, windowStartMs: start, windowEndMs: end,
  intervalMinutes: 30, ...overrides,
});
const movedRight = drag("move", 100);
assert.deepEqual([movedRight.startMs, movedRight.endMs], [Date.parse(at(6)), Date.parse(at(8))]);
assert.equal(movedRight.endMs - movedRight.startMs, 60 * 60_000);
assert.deepEqual([drag("move", -50).startMs, drag("move", -50).endMs], [Date.parse(at(3)), Date.parse(at(5))]);
assert.deepEqual([drag("start", -50).startMs, drag("start", -50).endMs], [Date.parse(at(3)), Date.parse(at(6))]);
assert.deepEqual([drag("end", 50).startMs, drag("end", 50).endMs], [Date.parse(at(4)), Date.parse(at(7))]);
assert.equal(drag("move", -250).outsideShift, true);
assert.equal(drag("move", 800).outsideShift, true);
assert.equal(drag("start", 150).outsideShift, true);
assert.equal(drag("end", -150).outsideShift, true);
assert.equal(dragOverlapsBooking(occupancy, "room", "own", Date.parse(at(6)), Date.parse(at(8))), false, "half-open adjacency is free");
assert.equal(dragOverlapsBooking(occupancy, "room", "own", Date.parse(at(7)), Date.parse(at(9))), true);
assert.equal(dragOverlapsBooking(occupancy, "room", "own", Date.parse(at(3)), Date.parse(at(5))), false, "own interval is excluded");

const confirmed = { id: "own", startTime: at(6), endTime: at(8), updatedAt: at(1) };
const next = applyConfirmedTime(occupancy, confirmed);
assert.equal(next[0].id, "own");
assert.equal(next[0].startTime, confirmed.startTime);
assert.equal(next[0].endTime, confirmed.endTime);
assert.equal(occupancy[0].startTime, at(4), "failed saves leave held state untouched");
assert.deepEqual(applyConfirmedTime([{ ...occupancy[0], reservationIds: ["own", "other"] }], confirmed)[0].startTime, at(4), "grouped blocks await server regrouping");
console.log("PASS booked-only rows, date changes, move/resize math, shift and overlap previews, confirmed sync");
