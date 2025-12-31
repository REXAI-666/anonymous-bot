const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const bot = new TelegramBot(token, { polling: true });
const replyMap = {};

console.log("Bot started...");

// 🔒 check channel join
async function isJoined(userId) {
  try {
    const member = await bot.getChatMember(FORCE_CHANNEL, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (e) {
    return false;
  }
}

bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;

  const joined = await isJoined(userId);
  if (!joined) {
    return bot.sendMessage(
      msg.chat.id,
      "🔒 To use this bot, you must join our channel first 👇",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_CHANNEL.replace("@", "")}` }],
            [{ text: "✅ Joined", callback_data: "check_join" }]
          ]
        }
      }
    );
  }

  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome to Anonymous Inbox\n\n✉️ Send any message. Your identity will stay hidden."
  );
});

// 🔁 re-check join
bot.on("callback_query", async (query) => {
  if (query.data === "check_join") {
    const joined = await isJoined(query.from.id);

    if (!joined) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ You haven't joined yet!",
        show_alert: true
      });
    }

    bot.sendMessage(
      query.from.id,
      "✅ Verified!\nNow you can send anonymous messages."
    );
  }
});

// 📨 main message handler
bot.on("message", async (msg) => {
  if (msg.text === "/start") return;

  // 🔒 force check again
  const joined = await isJoined(msg.from.id);
  if (!joined) return;

  // 👑 admin reply
  if (msg.reply_to_message && msg.from.id.toString() === ADMIN_ID) {
    const userId = replyMap[msg.reply_to_message.message_id];
    if (!userId) return;

    return bot.sendMessage(userId, `📩 Reply from admin:\n\n${msg.text}`);
  }

  // 👤 normal user
  if (msg.from.id.toString() !== ADMIN_ID) {
    const sent = await bot.sendMessage(
      ADMIN_ID,
      `📥 New Anonymous Message\n\n💬 ${msg.text}\n\n↩️ Reply to this message to respond`
    );

    replyMap[sent.message_id] = msg.from.id;

    bot.sendMessage(msg.chat.id, "✅ Your anonymous message has been sent.");
  }
});
