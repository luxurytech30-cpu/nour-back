const AdminDevice = require("../models/AdminDevice");
const User = require("../models/User");
const admin = require("../config/firebaseAdmin");

async function sendPushToRelevantAdmins({
  title,
  body,
  data = {},
  barberId = null,
  includeMainAdmins = false,
}) {
  try {
    console.log("========== PUSH START ==========");
    console.log("INPUT:", {
      title,
      body,
      data,
      barberId: barberId ? String(barberId) : null,
      includeMainAdmins,
    });

    const orConditions = [];

    if (includeMainAdmins) {
      orConditions.push({ isMainAdmin: true });
    }

    let linkedBarberUserIds = [];

    if (barberId) {
      orConditions.push({ barberId });

      const linkedUsers = await User.find({
        role: "admin",
        barberId,
      })
        .select("_id")
        .lean();

      linkedBarberUserIds = linkedUsers.map((user) => user._id);

      if (linkedBarberUserIds.length) {
        orConditions.push({ userId: { $in: linkedBarberUserIds } });
      }
    }

    console.log("PUSH OR CONDITIONS:", JSON.stringify(orConditions, null, 2));
    console.log(
      "LINKED BARBER USER IDS:",
      linkedBarberUserIds.map((id) => String(id)),
    );

    if (!orConditions.length) {
      console.log("NO TARGET CONDITIONS");
      console.log("========== PUSH END ==========");
      return;
    }

    const devices = await AdminDevice.find({
      enabled: true,
      $or: orConditions,
    }).lean();

    if (barberId && linkedBarberUserIds.length) {
      await AdminDevice.updateMany(
        {
          enabled: true,
          userId: { $in: linkedBarberUserIds },
          $or: [{ barberId: null }, { barberId: { $exists: false } }],
        },
        { $set: { barberId } },
      );
    }

    console.log(
      "MATCHED DEVICES:",
      devices.map((d) => ({
        _id: String(d._id),
        tokenPreview: d.token ? `${d.token.slice(0, 20)}...` : null,
        barberId: d.barberId ? String(d.barberId) : null,
        isMainAdmin: !!d.isMainAdmin,
        role: d.role || null,
        userId: d.userId ? String(d.userId) : null,
        enabled: d.enabled,
        platform: d.platform || null,
        lastSeenAt: d.lastSeenAt || null,
      })),
    );

    const tokens = [...new Set(devices.map((d) => d.token).filter(Boolean))];

    console.log(
      "TARGET PUSH TOKENS:",
      tokens.map((t) => `${t.slice(0, 20)}...`),
    );

    const payload = {
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
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          requireInteraction: true,
        },
        fcmOptions: {
          link: "/admin",
        },
      },
    };

    console.log("TARGET PUSH PAYLOAD:", {
      ...payload,
      tokens: payload.tokens.map((t) => `${t.slice(0, 20)}...`),
    });

    if (!tokens.length) {
      console.log("NO TOKENS TO SEND");
      console.log("========== PUSH END ==========");
      return;
    }

    const response = await admin.messaging().sendEachForMulticast(payload);

    console.log("PUSH SUCCESS:", response.successCount);
    console.log("PUSH FAIL:", response.failureCount);

    response.responses.forEach((r, i) => {
      console.log(`PUSH RESULT [${i}]`, {
        tokenPreview: tokens[i] ? `${tokens[i].slice(0, 20)}...` : null,
        success: r.success,
        errorCode: r.error?.code || null,
        errorMessage: r.error?.message || null,
      });
    });

    const failedTokens = response.responses
      .map((r, i) => ({
        success: r.success,
        token: tokens[i],
      }))
      .filter((x) => !x.success)
      .map((x) => x.token);

    if (failedTokens.length) {
      console.log(
        "DISABLING FAILED TOKENS:",
        failedTokens.map((t) => `${t.slice(0, 20)}...`),
      );

      await AdminDevice.updateMany(
        { token: { $in: failedTokens } },
        { $set: { enabled: false } },
      );
    }

    console.log("========== PUSH END ==========");
  } catch (error) {
    console.error("sendPushToRelevantAdmins error:", error);
  }
}

module.exports = { sendPushToRelevantAdmins };
