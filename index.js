require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const db = require('./db');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

function getBalance(userId) {
    const row = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
    return row ? row.balance : 0;
}

function addBalance(userId, amount) {
    const current = getBalance(userId);
    db.prepare('INSERT OR REPLACE INTO wallets (user_id, balance) VALUES (?, ?)').run(userId, current + amount);
}

function transferBalance(fromId, toId, amount) {
    const fromBal = getBalance(fromId);
    if (fromBal < amount) return false;
    addBalance(fromId, -amount);
    addBalance(toId, amount);
    return true;
}

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const [cmd, ...args] = message.content.trim().split(' ');

    if (cmd === '!balance') {
        const balance = getBalance(message.author.id);
        message.reply(`💰 คุณมี ${balance} บาท`);
    } else if (cmd === '!work') {
        const earned = Math.floor(Math.random() * 151) + 50;
        addBalance(message.author.id, earned);
        message.reply(`🛠️ คุณทำงานและได้ ${earned} บาท`);
    } else if (cmd === '!transfer') {
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount)) {
            return message.reply('❌ รูปแบบคำสั่งไม่ถูกต้อง: !transfer @user จำนวน');
        }

        const success = transferBalance(message.author.id, target.id, amount);
        if (success) {
            message.reply(`✅ โอน ${amount} บาทให้ ${target.username} แล้ว`);
        } else {
            message.reply(`💸 เงินไม่พอจะโอน!`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
