const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;
const BOT_USERNAME = process.env.BOT_USERNAME; // SecretCrushXBot

const bot = new TelegramBot(token, { polling: true });
const replyMap = {}; // admin reply tracking
const linkMap = {};  // public link tracking

console.log("Bot started...");

// 🔒 check if user joined channel
async function isJoined(userId) {
  try {
    const member = await bot.getChatMember(FORCE_CHANNEL, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

// ▶️ /start (normal + public link)
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const userId = msg.from.id;
  const payload = match[1]; // link owner id (if any)

  // force join check
  const joined = await isJoined(userId);
  if (!joined) {
    return bot.sendMessage(
      msg.chat.id,
      "🔒 To use this bot, you must join our channel first 👇",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📢 Join Channel",
                url: `https://t.me/${FORCE_CHANNEL.replace("@", "")}`
              }
            ],
            [{ text: "✅ Joined", callback_data: "check_join" }]
          ]
        }
      }
    );
  }

  // started via shared link
  if (payload && payload !== userId.toString()) {
    linkMap[userId] = payload; // who will receive message
    return bot.sendMessage(
      msg.chat.id,
      "💌 You opened a Secret Inbox!\n\n✉️ Send your anonymous message below 👇"
    );
  }

  // normal start (give personal link)
  const shareLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;

  bot.sendMessage(
    msg.chat.id,
    `👋 Welcome to Anonymous Inbox\n\n` +
    `🔗 Your personal anonymous link:\n${shareLink}\n\n` +
    `📢 Share this link to receive secret messages!`
  );
});

// 🔁 Joined button re-check
bot.on("callback_query", async (q) => {
  if (q.data === "check_join") {
    const joined = await isJoined(q.from.id);
    if (!joined) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ You haven't joined yet!",
        show_alert: true
      });
    }
    bot.sendMessage(
      q.from.id,
      "✅ Verified!\nNow you can use the bot."
    );
  }
});

// 📨 message handler
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/start")) return;

  // force join check again
  const joined = await isJoined(msg.from.id);
  if (!joined) return;

  // 👑 admin replying
  if (
    msg.reply_to_message &&
    msg.from.id.toString() === ADMIN_ID
  ) {
    const userId = replyMap[msg.reply_to_message.message_id];
    if (!userId) {
      return bot.sendMessage(
        ADMIN_ID,
        "❌ Reply failed. User not found."
      );
    }

    return bot.sendMessage(
      userId,
      `📩 Reply from admin:\n\n${msg.text}`
    );
  }

  // 👤 user sending anonymous message via link
  const targetUser = linkMap[msg.from.id];
  if (targetUser) {
    const sent = await bot.sendMessage(
      ADMIN_ID,
      `📥 New Secret Message\n\n💬 ${msg.text}\n\n↩️ Reply to respond`
    );

    replyMap[sent.message_id] = msg.from.id;

    return bot.sendMessage(
      msg.chat.id,
      "✅ Your anonymous message has been sent."
    );
  }
});
