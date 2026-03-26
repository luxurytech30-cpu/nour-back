const AdminDevice = require("../models/AdminDevice");
const admin = require("../config/firebaseAdmin");

async function sendPushToRelevantAdmins({
  title,
  body,
  data = {},
  barberId = null,
  includeMainAdmins = true,
}) {
  try {
    const orConditions = [];

    if (includeMainAdmins) {
      orConditions.push({ isMainAdmin: true });
    }

    if (barberId) {
      orConditions.push({ barberId });
    }

    if (!orConditions.length) {
      console.log("NO TARGET CONDITIONS");
      return;
    }

    const devices = await AdminDevice.find({
      enabled: true,
      $or: orConditions,
    }).lean();

    const tokens = [...new Set(devices.map((d) => d.token).filter(Boolean))];

    console.log("TARGET PUSH TOKENS:", tokens);
    console.log("TARGET PUSH PAYLOAD:", {
      title,
      body,
      data,
      barberId: barberId ? String(barberId) : null,
    });

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
        Object.entries({
          ...data,
          barberId: barberId ? String(barberId) : "",
        }).map(([k, v]) => [k, String(v)]),
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

    const failedTokens = response.responses
      .map((r, i) => ({
        success: r.success,
        token: tokens[i],
      }))
      .filter((x) => !x.success)
      .map((x) => x.token);

    if (failedTokens.length) {
      await AdminDevice.updateMany(
        { token: { $in: failedTokens } },
        { $set: { enabled: false } },
      );
    }
  } catch (error) {
    console.error("sendPushToRelevantAdmins error:", error);
  }
}

module.exports = { sendPushToRelevantAdmins };
