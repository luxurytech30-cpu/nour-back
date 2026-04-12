const Barber = require("../models/Barber");
const User = require("../models/User");
const { normalizeIsraeliPhone } = require("./sendMessageWa");

async function resolveUserBarberId(user) {
  if (!user) return null;

  if (user.barberId) {
    return user.barberId;
  }

  const userPhone = normalizeIsraeliPhone(user.phone);
  if (!userPhone) return null;

  const barbers = await Barber.find({ phone: { $ne: "" } })
    .select("_id phone")
    .lean();

  const barberByPhone = barbers.find(
    (barber) => normalizeIsraeliPhone(barber.phone) === userPhone,
  );

  if (!barberByPhone?._id) return null;

  await User.updateOne(
    { _id: user._id },
    { $set: { barberId: barberByPhone._id } },
  );

  return barberByPhone._id;
}

module.exports = { resolveUserBarberId };
