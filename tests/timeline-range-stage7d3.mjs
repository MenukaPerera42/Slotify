import assert from "node:assert/strict";
import { selectFreeTimelineRange } from "../src/features/resources/utils/timeline-range.ts";
import { generateBookingStartOptions, generateBookingEndOptions } from "../src/features/office-shifts/utils/shift-client-utils.ts";
import { createColomboISO, shiftColomboDate } from "../src/features/reservations/utils/client-date.ts";

const start = Date.parse("2026-10-20T02:30:00.000Z");
const end = start + 9.5 * 60 * 60_000;
const at = (slot) => new Date(start + slot * 30 * 60_000).toISOString();
const blocked = [{ resourceId: "room", status: "PENDING", startTime: at(4), endTime: at(6) }];
const select = (from, to, occupancy = blocked, resourceId = "room") =>
  selectFreeTimelineRange(resourceId, from, to, start, end, 30, occupancy);

assert.deepEqual(select(10, 12), { startIndex: 10, endIndex: 13, startMs: Date.parse(at(10)), endMs: Date.parse(at(13)) });
assert.deepEqual(select(12, 10), select(10, 12));
assert.deepEqual(select(3, 3), { startIndex: 3, endIndex: 4, startMs: Date.parse(at(3)), endMs: Date.parse(at(4)) });
assert.equal(select(3, 4), null, "a range cannot cross a pending booking");
assert.equal(select(5, 6), null, "a blocked starting slot cannot be selected");
assert.ok(select(6, 7), "a half-open adjacent range is free");
assert.equal(select(-1, 0), null);
assert.equal(select(18, 19), null, "a range cannot cross the shift end");
assert.ok(select(4, 5, [{ ...blocked[0], status: "CANCELLED" }]));
assert.ok(select(4, 5, blocked, "other-room"), "conflicts belong to the resource, independent of department");
const overnightStart = generateBookingStartOptions(22 * 60, 8 * 60).find((option) => option.timeStr === "01:00");
const overnightEnd = generateBookingEndOptions("01:00", 22 * 60, 8 * 60).find((option) => option.timeStr === "02:00");
assert.equal(overnightStart.dayOffset, 1);
assert.equal(overnightEnd.dayOffset, 1);
assert.equal(new Date(createColomboISO(shiftColomboDate("2026-10-20", overnightStart.dayOffset), overnightStart.timeStr)).toISOString(), "2026-10-20T19:30:00.000Z");
console.log("PASS free-range selection, adjacency, blocking, reverse order, shift limits, and overnight dates");
