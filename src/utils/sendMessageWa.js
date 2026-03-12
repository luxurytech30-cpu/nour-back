const axios = require("axios");

const GREEN_API_URL = process.env.GREEN_API_URL || "https://api.green-api.com";
const GREEN_ID_INSTANCE = process.env.GREEN_ID_INSTANCE;
const GREEN_API_TOKEN_INSTANCE = process.env.GREEN_API_TOKEN_INSTANCE;

function normalizeIsraeliPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;

  return digits;
}

function toChatId(phone) {
  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) return "";
  return `${normalized}@c.us`;
}

async function sendWhatsAppMessage(chatId, message) {
  if (!GREEN_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE) {
    throw new Error("Missing Green API credentials");
  }

  const url = `${GREEN_API_URL}/waInstance${GREEN_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`;

  const { data } = await axios.post(url, {
    chatId,
    message,
  });

  return data;
}

async function sendWhatsAppToPhone(phone, message) {
  const chatId = toChatId(phone);
  if (!chatId) throw new Error("Invalid phone for WhatsApp");
  return sendWhatsAppMessage(chatId, message);
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppToPhone,
  normalizeIsraeliPhone,
  toChatId,
};
