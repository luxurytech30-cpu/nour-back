const assert = require("node:assert/strict");

const {
  BLOCKING_BARBER_STATUSES,
  BLOCKING_CUSTOMER_STATUSES,
  buildBarberOverlapQuery,
  buildCustomerFutureAppointmentQuery,
} = require("../src/utils/appointmentRules");
const { validateAppointmentAgainstSchedule } = require("../src/utils/schedule");

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function buildBarberSchedule() {
  return {
    weeklyHours: {
      5: [{ start: "09:00", end: "18:00" }],
    },
    weeklyBreaks: {
      5: [{ start: "13:00", end: "13:30" }],
    },
    overrides: [],
  };
}

function localDate(year, monthIndex, day, hours, minutes) {
  return new Date(year, monthIndex, day, hours, minutes, 0, 0);
}

run("buildBarberOverlapQuery blocks overlapping bookings for the same barber", () => {
  const startAt = new Date("2026-04-24T10:00:00.000Z");
  const endAt = new Date("2026-04-24T10:30:00.000Z");

  const query = buildBarberOverlapQuery({
    barberId: "barber-1",
    startAt,
    endAt,
  });

  assert.deepEqual(query, {
    barberId: "barber-1",
    status: { $in: BLOCKING_BARBER_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  });
});

run("buildBarberOverlapQuery excludes the current appointment when editing", () => {
  const query = buildBarberOverlapQuery({
    barberId: "barber-1",
    startAt: new Date("2026-04-24T10:00:00.000Z"),
    endAt: new Date("2026-04-24T10:30:00.000Z"),
    excludeId: "appointment-123",
  });

  assert.deepEqual(query._id, { $ne: "appointment-123" });
});

run("buildCustomerFutureAppointmentQuery only blocks future active appointments", () => {
  const now = new Date("2026-04-24T09:00:00.000Z");
  const query = buildCustomerFutureAppointmentQuery({
    customerId: "user-1",
    phone: "0501234567",
    normalizedPhone: "972501234567",
    now,
  });

  assert.deepEqual(query.status, { $in: BLOCKING_CUSTOMER_STATUSES });
  assert.deepEqual(query.startAt, { $gte: now });
  assert.deepEqual(query.$or, [
    { createdByUserId: "user-1" },
    { phone: "0501234567" },
    { normalizedPhone: "972501234567" },
  ]);
});

run("buildCustomerFutureAppointmentQuery does not add empty identities", () => {
  const query = buildCustomerFutureAppointmentQuery({
    customerId: "",
    phone: "",
    normalizedPhone: "",
    now: new Date("2026-04-24T09:00:00.000Z"),
  });

  assert.deepEqual(query.$or, []);
});

run("validateAppointmentAgainstSchedule accepts an appointment inside working hours", () => {
  const barber = buildBarberSchedule();

  const result = validateAppointmentAgainstSchedule(
    barber,
    localDate(2026, 3, 24, 10, 0),
    localDate(2026, 3, 24, 10, 30),
  );

  assert.deepEqual(result, { ok: true });
});

run("validateAppointmentAgainstSchedule blocks an appointment overlapping a break", () => {
  const barber = buildBarberSchedule();

  const result = validateAppointmentAgainstSchedule(
    barber,
    localDate(2026, 3, 24, 13, 10),
    localDate(2026, 3, 24, 13, 40),
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, "Appointment overlaps a break");
});

run("validateAppointmentAgainstSchedule blocks a closed override date", () => {
  const barber = buildBarberSchedule();
  barber.overrides = [{ date: "2026-04-24", isClosed: true, hours: [], breaks: [] }];

  const result = validateAppointmentAgainstSchedule(
    barber,
    new Date("2026-04-24T10:00:00.000Z"),
    new Date("2026-04-24T10:30:00.000Z"),
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, "This day is closed");
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
