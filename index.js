const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// ===== ENV =====
const token = process.env.BOT_TOKEN;
const MAIN_ADMIN = process.env.ADMIN_ID;
const ADMINS = (process.env.ADMINS || "").split(",").filter(Boolean);
const BOT_USERNAME = process.env.BOT_USERNAME;

// multiple force join channels (comma separated usernames)
const FORCE_CHANNELS = (process.env.FORCE_CHANNELS || "")
  .split(",")
  .map(c => c.trim())
  .filter(Boolean);

// ===== BOT =====
const bot = new TelegramBot(token, { polling: true });
console.log("Bot started...");

// ===== DATABASE (FILE) =====
const DB_FILE = "./db.json";
let db = {
  users: {},
  banned: {},
  stats: {},
  anonEnabled: true
};

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== HELPERS =====
function isAdmin(id) {
  return id.toString() === MAIN_ADMIN || ADMINS.includes(id.toString());
}

async function isJoinedAll(userId) {
  for (const ch of FORCE_CHANNELS) {
    try {
      const m = await bot.getChatMember(ch, userId);
      if (!["member", "administrator", "creator"].includes(m.status)) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

// ===== /START =====
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const userId = msg.from.id;
  db.users[userId] = true;
  db.stats[userId] = db.stats[userId] || { sent: 0 };
  saveDB();

  if (db.banned[userId]) return;

  if (!(await isJoinedAll(userId))) {
    return bot.sendMessage(
      msg.chat.id,
      "🔒 Bot use karne ke liye **sab channels join** karna zaroori hai 👇"
    );
  }

  if (!db.anonEnabled) {
    return bot.sendMessage(
      msg.chat.id,
      "⛔ Anonymous inbox abhi OFF hai.\nBaad me try karo."
    );
  }

  const payload = match[1];
  if (payload && payload !== userId.toString()) {
    db.users[payload] = true;
    saveDB();
    return bot.sendMessage(
      msg.chat.id,
      "💌 Secret Inbox Opened!\nText / Photo / Voice bhejo (Video ❌)"
    );
  }

  const link = `https://t.me/${BOT_USERNAME}?start=${userId}`;
  bot.sendMessage(
    msg.chat.id,
    `👋 Welcome!\n\n🔗 Tumhara anonymous link:\n${link}`
  );
});

// ===== ADMIN COMMANDS =====

// ON / OFF anonymous
bot.onText(/\/anon_on/, msg => {
  if (!isAdmin(msg.from.id)) return;
  db.anonEnabled = true;
  saveDB();
  bot.sendMessage(msg.chat.id, "✅ Anonymous mode ON");
});

bot.onText(/\/anon_off/, msg => {
  if (!isAdmin(msg.from.id)) return;
  db.anonEnabled = false;
  saveDB();
  bot.sendMessage(msg.chat.id, "⛔ Anonymous mode OFF");
});

// user stats
bot.onText(/\/userstats (\d+)/, (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  const id = match[1];
  const s = db.stats[id];
  if (!s) {
    return bot.sendMessage(msg.chat.id, "❌ No data for this user");
  }
  bot.sendMessage(
    msg.chat.id,
    `📊 User ${id}\nMessages sent: ${s.sent}`
  );
});

// ban / unban (MAIN ADMIN)
bot.onText(/\/ban (\d+)/, (msg, match) => {
  if (msg.from.id.toString() !== MAIN_ADMIN) return;
  db.banned[match[1]] = true;
  saveDB();
  bot.sendMessage(msg.chat.id, "🚫 User banned");
});

bot.onText(/\/unban (\d+)/, (msg, match) => {
  if (msg.from.id.toString() !== MAIN_ADMIN) return;
  delete db.banned[match[1]];
  saveDB();
  bot.sendMessage(msg.chat.id, "✅ User unbanned");
});

// ===== MESSAGE HANDLER =====
bot.on("message", async msg => {
  const userId = msg.from.id;
  if (msg.text?.startsWith("/start")) return;
  if (db.banned[userId]) return;
  if (!db.anonEnabled) return;
  if (!(await isJoinedAll(userId))) return;

  db.stats[userId] = db.stats[userId] || { sent: 0 };
  db.stats[userId].sent++;
  saveDB();

  // BLOCK VIDEO
  if (msg.video) {
    return bot.sendMessage(
      msg.chat.id,
      "❌ Video allowed nahi hai"
    );
  }

  // forward to main admin
  if (msg.text) {
    bot.sendMessage(
      MAIN_ADMIN,
      `📥 Anonymous Message\n\n${msg.text}`
    );
  } else if (msg.photo) {
    bot.sendPhoto(MAIN_ADMIN, msg.photo.at(-1).file_id, {
      caption: "📥 Anonymous Photo"
    });
  } else if (msg.voice) {
    bot.sendVoice(MAIN_ADMIN, msg.voice.file_id, {
      caption: "📥 Anonymous Voice"
    });
  }
});
