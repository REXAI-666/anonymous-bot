const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const FORCE_CHANNEL = process.env.FORCE_CHANNEL;
const BOT_USERNAME = process.env.BOT_USERNAME;

const bot = new TelegramBot(token, { polling: true });

console.log("Bot started...");

// ===== STORAGE =====
const replyMap = {};   // admin reply tracking
const linkMap = {};    // public link sender → receiver
const userMessageLog = {}; // anti-spam log

// ===== ANTI-SPAM CONFIG =====
const MESSAGE_LIMIT = 5; // messages
const TIME_WINDOW = 60 * 60 * 1000; // 1 hour

function isSpamming(userId) {
  const now = Date.now();

  if (!userMessageLog[userId]) {
    userMessageLog[userId] = [];
  }

  userMessageLog[userId] = userMessageLog[userId].filter(
    (t) => now - t < TIME_WINDOW
  );

  if (userMessageLog[userId].length >= MESSAGE_LIMIT) {
    return true;
  }

  userMessageLog[userId].push(now);
  return false;
}

// ===== FORCE JOIN CHECK =====
async function isJoined(userId) {
  try {
    const member = await bot.getChatMember(FORCE_CHANNEL, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

// ===== START COMMAND (NORMAL + PUBLIC LINK) =====
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const userId = msg.from.id;
  const payload = match[1];

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

  // Opened via shared link
  if (payload && payload !== userId.toString()) {
    linkMap[userId] = payload;
    return bot.sendMessage(
      msg.chat.id,
      "💌 You opened a Secret Inbox!\n\n✉️ Send your anonymous message below 👇"
    );
  }

  // Normal start
  const shareLink = `https://t.me/${BOT_USERNAME}?start=${userId}`;

  bot.sendMessage(
    msg.chat.id,
    `👋 Welcome to Anonymous Inbox\n\n` +
      `🔗 Your personal anonymous link:\n${shareLink}\n\n` +
      `📢 Share this link to receive secret messages!`
  );
});

// ===== JOIN CHECK BUTTON =====
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

// ===== MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/start")) return;

  const joined = await isJoined(msg.from.id);
  if (!joined) return;

  // ===== ADMIN REPLY =====
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

  // ===== ANTI-SPAM (SKIP ADMIN) =====
  if (msg.from.id.toString() !== ADMIN_ID) {
    if (isSpamming(msg.from.id)) {
      return bot.sendMessage(
        msg.chat.id,
        "🚫 Slow down!\nYou can send only 5 messages per hour."
      );
    }
  }

  // ===== USER SENDING ANONYMOUS MESSAGE =====
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
