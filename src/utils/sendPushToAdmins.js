// utils/sendPushToAdmins.js
const AdminDevice = require("../models/AdminDevice");
const admin = require("../config/firebaseAdmin"); // firebase-admin init

async function sendPushToAdmins({ title, body, data = {} }) {
  const devices = await AdminDevice.find({ enabled: true }).lean();
  const tokens = devices.map((d) => d.token).filter(Boolean);

  if (!tokens.length) return;

  const message = {
    tokens,
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    ),
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // optional: disable invalid tokens
  const invalidIndexes = [];
  response.responses.forEach((r, i) => {
    if (!r.success) invalidIndexes.push(i);
  });

  if (invalidIndexes.length) {
    const invalidTokens = invalidIndexes.map((i) => tokens[i]);
    await AdminDevice.updateMany(
      { token: { $in: invalidTokens } },
      { $set: { enabled: false } },
    );
  }
}

module.exports = { sendPushToAdmins };
