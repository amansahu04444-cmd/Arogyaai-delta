const TelegramBot = require("node-telegram-bot-api");
const { getClient } = require('../config/db');

let botInstance = null;

/**
 * Initializes the Telegram Bot.
 * In production/staging (when BACKEND_URL or RENDER_EXTERNAL_URL is set), it uses Webhooks.
 * In development, it falls back to polling mode.
 */
function initTelegramBot(app) {
  if (global.telegramBotRunning) {
    console.log("⚠️ Telegram bot already running. Skipping initialization.");
    return botInstance;
  }
  global.telegramBotRunning = true;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const isPlaceholder = !token || token === 'your_telegram_bot_token_here' || token === 'undefined';

  if (isPlaceholder) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is missing or placeholder. Telegram Bot disabled.');
    return null;
  }

  try {
    const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
    const isProduction = process.env.NODE_ENV === 'production' || !!backendUrl;

    if (isProduction && backendUrl) {
      console.log(`🌐 Initializing Telegram Bot in WEBHOOK mode. Base URL: ${backendUrl}`);
      botInstance = new TelegramBot(token, { polling: false });

      // Secure token-based route
      const webhookPath = `/api/telegram/webhook/${token}`;
      const webhookUrl = `${backendUrl.replace(/\/$/, '')}${webhookPath}`;

      botInstance.setWebHook(webhookUrl)
        .then(() => {
          console.log(`✅ Telegram Webhook registered successfully: ${webhookUrl}`);
        })
        .catch((err) => {
          console.error("❌ Failed to set Telegram Webhook:", err.message);
        });

      // Register express POST route handler inside the app to forward updates to the bot
      app.post(webhookPath, (req, res) => {
        try {
          botInstance.processUpdate(req.body);
          res.sendStatus(200);
        } catch (err) {
          console.error("❌ Error processing Telegram webhook update:", err);
          res.sendStatus(200); // Send 200 to avoid Telegram webhook delivery retries
        }
      });

    } else {
      console.log("🔌 Initializing Telegram Bot in POLLING mode (Development)");
      botInstance = new TelegramBot(token, {
        polling: {
          interval: 300,
          autoStart: true,
          params: { timeout: 10 }
        }
      });

      botInstance.on("polling_error", (error) => {
        if (error?.message?.includes("409")) return;
        console.warn("Telegram polling error:", error.message);
      });

      const stopBot = () => {
        if (botInstance) {
          botInstance.stopPolling();
          console.log('🛑 Telegram bot polling stopped.');
        }
      };

      process.once("SIGINT", stopBot);
      process.once("SIGTERM", stopBot);
      process.once("SIGUSR2", stopBot);
    }

    // Common Message Handler for linking user accounts
    botInstance.on('message', async (msg) => {
      try {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!chatId || !text) return;

        // Handle /start with Member ID (UUID)
        if (text.startsWith('/start')) {
          const parts = text.split(' ');
          const memberId = parts[1]; // Now treating this as the record ID (UUID)

          if (memberId) {
            console.log(`📡 ATTEMPTING LINK: ChatID ${chatId} for Member ${memberId}`);
            
            const supabase = getClient();
            if (!supabase) throw new Error('Database not connected');

            // Update record where ID matches
            const { data, error } = await supabase
              .from('family_members')
              .update({ 
                  telegram_chat_id: chatId.toString()
              })
              .eq('id', memberId)
              .select();

            if (error) {
              console.error("❌ Database link error:", error);
              botInstance.sendMessage(chatId, '❌ Connection failed. Please ensure you used the correct link from the app.');
            } else if (data && data.length > 0) {
              console.log(`✅ LINK SUCCESSFUL: ${data[0].name} linked to ${chatId}`);
              botInstance.sendMessage(chatId, `✅ <b>Connection Successful!</b>\n\nYou will now receive emergency alerts for <b>${data[0].name}</b>.`, { parse_mode: 'HTML' });
            } else {
              console.warn(`⚠️ NO MATCH: Member ID ${memberId} not found.`);
              botInstance.sendMessage(chatId, '❌ Connection link invalid or expired.');
            }
          } else {
            botInstance.sendMessage(chatId, 'Welcome to ArogyaAI! 🏥\n\nPlease use the link in the app to connect your account.');
          }
        }
      } catch (handlerError) {
        console.error("❌ Telegram Handler Error:", handlerError);
      }
    });

  } catch (err) {
    console.error('❌ Failed to start Telegram Bot:', err);
  }

  return botInstance;
}

module.exports = {
  initTelegramBot,
  getBotInstance: () => botInstance
};

