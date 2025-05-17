const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const _ = require("lodash");
const dotenv = require("dotenv")
dotenv.config()

const token = process.env.TELEGRAM_API_TOKEN;
const bot = new TelegramBot(token, { polling: true });
bot.on("polling_error", (error) => {
  console.error("Polling error:", error.code, error.message);
});

bot.on("webhook_error", (error) => {
  console.error("Webhook error:", error);
});

bot.setMyCommands([
  { command: "listgold", description: "Xem giá vàng theo danh sách" },
  { command: "price", description: "xem chi tiết từng giá vàng" },
  { command: "listmoney", description: "Xem tỷ giá ngoại tệ theo danh sách" },
  { command: "money", description: "xem chi tiết từng tỉ giá tiền tệ" },
  { command: "help", description: "Hướng dẫn sử dụng" },
]);

const GOLD_API_URL = "https://exchange.goonus.io/exchange/api/v1/golds";
const FIAT_API_URL = "https://exchange.goonus.io/exchange/api/v1/fiat";

function normalizeString(str) {
  return _.deburr(str)
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .trim();
}

function formatCurrency(num) {
  return parseFloat(num).toLocaleString("vi-VN");
}

function formatChange(change) {
  if (change > 0) {
    return `📈 +${formatCurrency(change)}`;
  } else if (change < 0) {
    return `📉 ${formatCurrency(change)}`;
  }
  return "➖ Không đổi";
}

// Hàm lấy giá vàng
async function getGoldPrices() {
  try {
    const response = await axios.get(GOLD_API_URL);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching gold prices:", error);
    return null;
  }
}

async function getFiatRates() {
  try {
    const response = await axios.get(FIAT_API_URL);

    return response.data.data;
  } catch (error) {
    console.error("Error fetching fiat rates:", error);
    return null;
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const helpText =
    `🏦 <b>Bot Tra Cứu Giá Vàng và Tỷ Giá</b>\n\n` +
    `📌 <b>Các lệnh hỗ trợ:</b>\n` +
    `/listgold - Xem danh sách các loại vàng\n` +
    `/listmoney - Xem danh sách các loại ngoại tệ\n` +
    `/price [tên vàng] - Tra cứu giá vàng cụ thể\n` +
    `/money [mã ngoại tệ] - Tra cứu tỷ giá cụ thể\n` +
    `/help - Xem hướng dẫn chi tiết`;

  bot.sendMessage(chatId, helpText, { parse_mode: "HTML" });
});

bot.onText(/\/listgold/, async (msg) => {
  const chatId = msg.chat.id;
  const goldData = await getGoldPrices();

  if (goldData && goldData.length > 0) {
    let message = "🏅 <b>Danh sách các loại vàng:</b>\n\n";
    goldData.forEach((item, index) => {
      message += `${index + 1}. ${item.type}\n`;
    });
    message += `\nSử dụng lệnh <code>/price [tên vàng]</code>  để tra cứu chi tiết`;
    bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  } else {
    bot.sendMessage(
      chatId,
      "⚠️ Không thể lấy danh sách vàng. Vui lòng thử lại sau."
    );
  }
});

bot.onText(/\/listmoney/, async (msg) => {
  const chatId = msg.chat.id;
  const fiatData = await getFiatRates();

  if (fiatData && fiatData.length > 0) {
    let message = "💱 <b>Danh sách các loại ngoại tệ:</b>\n\n";
    fiatData.forEach((item, index) => {
      message += `${index + 1}. ${item.name} (${item.code})\n`;
    });
    message += `\nSử dụng lệnh <code>/money [mã ngoại tệ]</code> để tra cứu chi tiết`;
    bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  } else {
    bot.sendMessage(
      chatId,
      "⚠️ Không thể lấy danh sách ngoại tệ. Vui lòng thử lại sau."
    );
  }
});

// Xử lý lệnh /price
bot.onText(/\/price(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const goldName = match[1] ? match[1].trim() : null;

  if (!goldName) {
    return bot.sendMessage(
      chatId,
      "⚠️ Vui lòng nhập tên loại vàng. Ví dụ: <code>/price Vàng SJC 1 chỉ</code>",
      { parse_mode: "HTML" }
    );
  }

  const goldData = await getGoldPrices();
  if (!goldData || goldData.length === 0) {
    return bot.sendMessage(
      chatId,
      "⚠️ Không thể lấy giá vàng. Vui lòng thử lại sau."
    );
  }

  const normalizedInput = normalizeString(goldName);
  const foundGold = goldData.find(
    (item) =>
      normalizeString(item.type).includes(normalizedInput) ||
      normalizeString(item.slug).includes(normalizedInput)
  );

  if (foundGold) {
    const message =
      `🏅 <b>Thông tin chi tiết vàng ${foundGold.type}</b>\n\n` +
      `💰 <b>Giá mua:</b> ${formatCurrency(foundGold.buy)} VND\n` +
      `💵 <b>Giá bán:</b> ${formatCurrency(foundGold.sell)} VND\n` +
      `🔄 <b>Biến động giá mua:</b> ${formatChange(foundGold.changeBuy)}\n` +
      `🔄 <b>Biến động giá bán:</b> ${formatChange(foundGold.changeSell)}\n` +
      `📢 <b>Nguồn:</b> ${foundGold.source}\n` +
      `⏰ <b>Cập nhật:</b> ${new Date(foundGold.timestamp).toLocaleString(
        "vi-VN"
      )}\n\n` +
      `🔗 <b>Slug:</b> ${foundGold.slug}\n` +
      `🚫 <b>Trạng thái:</b> ${
        foundGold.disable ? "Ngừng giao dịch" : "Đang giao dịch"
      }`;

    bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  } else {
    bot.sendMessage(
      chatId,
      `⚠️ Không tìm thấy loại vàng "${goldName}". Sử dụng /listgold để xem danh sách.`
    );
  }
});

bot.onText(/\/money(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const slug = match[1]?.trim().toUpperCase();

  if (!slug) {
    return bot.sendMessage(
      chatId,
      "ℹ️ Vui lòng nhập mã ngoại tệ (VD: /money USD)",
      { parse_mode: "HTML" }
    );
  }

  const fiatData = await getFiatRates();
  const currency = fiatData?.find(
    (item) => item.code === slug || item.slug === slug.toLowerCase()
  );

  if (currency) {
    const message =
      `🌍 <b>${currency.name} (${currency.code})</b>\n` +
      `💰 Mua: ${formatCurrency(currency.buy)} VND\n` +
      `💵 Bán: ${formatCurrency(currency.sell)} VND\n` +
      `🔄 Cập nhật: ${new Date(currency.ts).toLocaleString("vi-VN")}`;

    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  } else {
    await bot.sendMessage(chatId, `⚠️ Không tìm thấy ngoại tệ mã "${slug}"`);
  }
});

bot.onText(/\/gold/, async (msg) => {
  const chatId = msg.chat.id;
  const goldData = await getGoldPrices();

  if (goldData?.length > 0) {
    let message = "🏅 <b>Danh sách giá vàng</b> (Chọn số để xem chi tiết):\n\n";
    goldData.forEach((item, index) => {
      message += `${index + 1}. ${item.type}\n`;
    });

    const keyboard = {
      reply_markup: {
        keyboard: [
          Array.from({ length: Math.min(5, goldData.length) }, (_, i) => ({
            text: `${i + 1}`,
          })),
          ["↩ Quay lại"],
        ],
        resize_keyboard: true,
      },
    };

    await bot.sendMessage(chatId, message, { parse_mode: "HTML", ...keyboard });
  } else {
    bot.sendMessage(chatId, "⚠️ Không có dữ liệu giá vàng");
  }
});

bot.on("message", async (msg) => {
  if (/^\d+$/.test(msg.text)) {
    const index = parseInt(msg.text) - 1;
    const goldData = await getGoldPrices();

    if (goldData?.[index]) {
      const item = goldData[index];
      const message =
        `🔸 <b>${item.type}</b>\n` +
        `💰 Mua: ${formatCurrency(item.buy)} VND\n` +
        `💵 Bán: ${formatCurrency(item.sell)} VND\n` +
        `🔄 Cập nhật: ${new Date(item.timestamp).toLocaleString("vi-VN")}`;

      await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
    }
  }
});

bot.on("message", (msg) => {
  if (msg.text === "/") {
    showCommandSuggestions(msg.chat.id);
  }
});

function showCommandSuggestions(chatId) {
  bot.sendMessage(
    chatId,
    `🏦 <b>Bot Tra Cứu Giá Vàng và Tỷ Giá</b>\n\n` +
      `📌 <b>Các lệnh hỗ trợ:</b>\n` +
      `/listgold - Xem danh sách các loại vàng\n` +
      `/listmoney - Xem danh sách các loại ngoại tệ\n` +
      `/price [tên vàng] - Tra cứu giá vàng cụ thể\n` +
      `/money [mã ngoại tệ] - Tra cứu tỷ giá cụ thể\n` +
      `/help - Xem hướng dẫn chi tiết`,
    { parse_mode: "HTML" }
  );
}

bot.onText(/\/help/, (msg) => {
  showCommandSuggestions(msg.chat.id);
});

console.log("Bot đã sẵn sàng hoạt động...");
