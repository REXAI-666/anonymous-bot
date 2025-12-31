const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(token, { polling: true });

console.log("Bot started...");

// User starts bot
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome to Anonymous Inbox\n\n✉️ Send any message. Your identity will stay hidden."
  );
});

// Handle normal messages
bot.on("message", (msg) => {
  if (msg.text === "/start") return;

  // If admin replies
  if (msg.reply_to_message && msg.from.id.toString() === ADMIN_ID) {
    const userId = msg.reply_to_message.text.split("ID: ")[1];
    if (userId) {
      bot.sendMessage(userId, `📩 Reply from admin:\n\n${msg.text}`);
    }
    return;
  }

  // If normal user sends message
  if (msg.from.id.toString() !== ADMIN_ID) {
    const anonymousMessage =
      `📥 New Anonymous Message\n\n` +
      `🕶️ From: Anonymous User\n` +
      `🆔 ID: ${msg.from.id}\n\n` +
      `💬 Message:\n${msg.text}\n\n` +
      `↩️ Reply to this message to respond`;

    bot.sendMessage(ADMIN_ID, anonymousMessage);
    bot.sendMessage(msg.chat.id, "✅ Your anonymous message has been sent.");
  }
});
