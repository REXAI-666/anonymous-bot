const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

console.log("Bot started...");

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome!\n\nSend me any message and it will stay anonymous."
  );
});

bot.on("message", (msg) => {
  if (msg.text === "/start") return;

  bot.sendMessage(
    msg.chat.id,
    "✅ Your message has been sent anonymously."
  );
});
