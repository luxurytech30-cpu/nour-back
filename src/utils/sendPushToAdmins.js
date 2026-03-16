const AdminDevice = require("../models/AdminDevice");
const admin = require("../config/firebaseAdmin");

async function sendPushToAdmins({ title, body, data = {} }) {
  try {
    const devices = await AdminDevice.find({ enabled: true }).lean();
    const tokens = devices.map((d) => d.token).filter(Boolean);

    console.log("PUSH TOKENS:", tokens);
    console.log("PUSH PAYLOAD:", { title, body, data });

    if (!tokens.length) {
      console.log("NO TOKENS TO SEND");
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ),
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon.png",
        },
      },
    });

    console.log("PUSH SUCCESS:", response.successCount);
    console.log("PUSH FAIL:", response.failureCount);
    console.log(
      "PUSH RESPONSES:",
      response.responses.map((r) => ({
        success: r.success,
        error: r.error?.message || null,
      })),
    );
  } catch (error) {
    console.error("sendPushToAdmins error:", error);
  }
}

module.exports = { sendPushToAdmins };
