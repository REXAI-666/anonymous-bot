const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;

const bot = new TelegramBot(token, { polling: true });
const replyMap = {};

console.log("Bot started...");

// 🔒 force join check
async function isJoined(userId) {
  try {
    const member = await bot.getChatMember(FORCE_CHANNEL, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

// ▶️ START with payload (public link)
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const userId = msg.from.id;
  const payload = match[1]; // who owns the link

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

  // if started via shared link
  if (payload && payload !== userId.toString()) {
    replyMap[msg.message_id] = payload;
    return bot.sendMessage(
      msg.chat.id,
      "💌 You opened a Secret Inbox!\n\n✉️ Send your anonymous message below 👇"
    );
  }

  // normal start
  const shareLink = `https://t.me/${bot.username}?start=${userId}`;

  bot.sendMessage(
    msg.chat.id,
    `👋 Welcome to Anonymous Inbox\n\n🔗 Your personal anonymous link:\n${shareLink}\n\n📢 Share this link to receive secret messages!`
  );
});

// 🔁 joined button
bot.on("callback_query", async (q) => {
  if (q.data === "check_join") {
    const joined = await isJoined(q.from.id);
    if (!joined) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ You haven't joined yet!",
        show_alert: true
      });
    }
    bot.sendMessage(q.from.id, "✅ Verified! Now send your message.");
  }
});

// 📨 message handler
bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/start")) return;

  const joined = await isJoined(msg.from.id);
  if (!joined) return;

  // 👑 admin reply
  if (msg.reply_to_message && msg.from.id.toString() === ADMIN_ID) {
    const userId = replyMap[msg.reply_to_message.message_id];
    if (!userId) return;
    return bot.sendMessage(userId, `📩 Reply from admin:\n\n${msg.text}`);
  }

  // 👤 user sending message via shared link
  const targetId = replyMap[msg.message_id];
  if (targetId) {
    const sent = await bot.sendMessage(
      ADMIN_ID,
      `📥 New Secret Message\n\n💬 ${msg.text}\n\n↩️ Reply to respond`
    );
    replyMap[sent.message_id] = msg.from.id;
    return bot.sendMessage(msg.chat.id, "✅ Your secret message has been sent.");
  }
});
