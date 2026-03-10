function timeToMin(t) {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

function dateToMin(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function rangesToMinutes(ranges) {
  const out = [];
  for (const r of ranges || []) {
    const s = timeToMin(r.start);
    const e = timeToMin(r.end);
    if (s < e) out.push([s, e]);
  }
  return out;
}

function getDaySchedule(barber, dateStr) {
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  const dayKey = String(dow);

  const override = (barber.overrides || []).find((o) => o.date === dateStr);

  if (override?.isClosed) {
    return { isClosed: true, hours: [], breaks: [] };
  }

  const hours = override?.hours?.length
    ? override.hours
    : (barber.weeklyHours?.get
        ? barber.weeklyHours.get(dayKey)
        : barber.weeklyHours?.[dayKey]) || [];

  const breaks = override?.breaks?.length
    ? override.breaks
    : (barber.weeklyBreaks?.get
        ? barber.weeklyBreaks.get(dayKey)
        : barber.weeklyBreaks?.[dayKey]) || [];

  return { isClosed: false, hours, breaks };
}

function insideAnyRange(startMin, endMin, ranges) {
  return ranges.some(([s, e]) => startMin >= s && endMin <= e);
}

function overlapsAnyRange(startMin, endMin, ranges) {
  return ranges.some(([s, e]) => startMin < e && endMin > s);
}

function validateAppointmentAgainstSchedule(barber, startAt, endAt) {
  const dateStr = new Date(startAt).toISOString().slice(0, 10);
  const schedule = getDaySchedule(barber, dateStr);

  if (schedule.isClosed) {
    return { ok: false, message: "This day is closed" };
  }

  const startMin = dateToMin(new Date(startAt));
  const endMin = dateToMin(new Date(endAt));

  if (!(startMin < endMin)) {
    return { ok: false, message: "Invalid time range" };
  }

  const hourRanges = rangesToMinutes(schedule.hours);
  const breakRanges = rangesToMinutes(schedule.breaks);

  if (!insideAnyRange(startMin, endMin, hourRanges)) {
    return { ok: false, message: "Appointment is outside working hours" };
  }

  if (overlapsAnyRange(startMin, endMin, breakRanges)) {
    return { ok: false, message: "Appointment overlaps a break" };
  }

  return { ok: true };
}

module.exports = {
  validateAppointmentAgainstSchedule,
};
