const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;

const bot = new TelegramBot(token, { polling: true });

console.log("Bot started...");

// userId -> receiverId
const linkMap = {};

// ===== /START =====
bot.onText(/\/start(?: (.+))?/, (msg, match) => {
  const userId = msg.from.id;
  const payload = match[1];

  // Sender mode
  if (payload && payload !== userId.toString()) {
    linkMap[userId] = payload;
    return bot.sendMessage(
      msg.chat.id,
      "💌 Anonymous Inbox Opened!\n\nText / Photo bhejo.\n❌ /start mat dabana"
    );
  }

  // Receiver mode
  const link = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  bot.sendMessage(
    msg.chat.id,
    `👋 Welcome!\n\n🔗 Tumhara anonymous link:\n${link}\n\nIs link ko share karo.`
  );
});

// ===== MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  const userId = msg.from.id;

  if (msg.text?.startsWith("/start")) return;

  const receiverId = linkMap[userId];
  if (!receiverId) return;

  // TEXT
  if (msg.text) {
    await bot.sendMessage(
      receiverId,
      `📩 Anonymous Message:\n\n${msg.text}`
    );
    return bot.sendMessage(msg.chat.id, "✅ Anonymous message sent");
  }

  // PHOTO
  if (msg.photo) {
    await bot.sendPhoto(
      receiverId,
      msg.photo.at(-1).file_id,
      { caption: "📷 Anonymous Photo" }
    );
    return bot.sendMessage(msg.chat.id, "✅ Anonymous photo sent");
  }

  // BLOCK VIDEO
  if (msg.video) {
    return bot.sendMessage(
      msg.chat.id,
      "❌ Video allowed nahi hai"
    );
  }
});
