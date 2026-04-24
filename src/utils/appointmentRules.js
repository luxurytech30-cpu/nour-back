const BLOCKING_BARBER_STATUSES = ["booked", "in_service", "checked_in"];
const BLOCKING_CUSTOMER_STATUSES = ["booked", "checked_in", "in_service"];

function buildBarberOverlapQuery({ barberId, startAt, endAt, excludeId = null }) {
  const query = {
    barberId,
    status: { $in: BLOCKING_BARBER_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return query;
}

function buildCustomerFutureAppointmentQuery({
  customerId,
  phone,
  normalizedPhone,
  now = new Date(),
  statuses = BLOCKING_CUSTOMER_STATUSES,
}) {
  const query = {
    status: { $in: statuses },
    startAt: { $gte: now },
    $or: [],
  };

  if (customerId) {
    query.$or.push({ createdByUserId: customerId });
  }

  if (phone) {
    query.$or.push({ phone });
  }

  if (normalizedPhone) {
    query.$or.push({ normalizedPhone });
  }

  return query;
}

module.exports = {
  BLOCKING_BARBER_STATUSES,
  BLOCKING_CUSTOMER_STATUSES,
  buildBarberOverlapQuery,
  buildCustomerFutureAppointmentQuery,
};
