require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
const db = require('./db');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let globalMathChallenge = null; // เปลี่ยนจาก per-user เป็น global
const stealAttempts = new Map();

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

function getBalance(userId) {
    const row = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId);
    return row ? row.balance : 0;
}

function getKarma(userId) {
    const row = db.prepare('SELECT karma FROM wallets WHERE user_id = ?').get(userId);
    return row && typeof row.karma !== 'undefined' ? row.karma : 50;
}

function addBalance(userId, amount) {
    const current = getBalance(userId);
    const karma = getKarma(userId);
    db.prepare('INSERT OR REPLACE INTO wallets (user_id, balance, karma) VALUES (?, ?, ?)').run(userId, current + amount, karma);
}

function updateKarma(userId, delta) {
    const balance = getBalance(userId);
    const currentKarma = getKarma(userId);
    db.prepare('INSERT OR REPLACE INTO wallets (user_id, balance, karma) VALUES (?, ?, ?)').run(userId, balance, currentKarma + delta);
}

function transferBalance(fromId, toId, amount) {
    const fromBal = getBalance(fromId);
    if (fromBal < amount) return false;
    addBalance(fromId, -amount);
    addBalance(toId, amount);
    return true;
}

function generateHardMathQuestion() {
    const a = Math.floor(Math.random() * 100) + 50;
    const b = Math.floor(Math.random() * 100) + 50;
    const c = Math.floor(Math.random() * 10) + 1;
    const question = `${a} + ${b} * ${c}`;
    const answer = a + b * c;
    return { question, answer };
}

function getWeightedRandomReward() {
    const rand = Math.random() * 100;
    if (rand <= 50) return Math.floor(Math.random() * 10) + 1;       // 1-10 บาท (50%)
    if (rand <= 70) return Math.floor(Math.random() * 20) + 11;      // 11-30 บาท (20%)
    if (rand <= 85) return Math.floor(Math.random() * 10) + 41;      // 41-50 บาท (15%)
    if (rand <= 95) return Math.floor(Math.random() * 30) + 51;      // 51-80 บาท (10%)
    return Math.floor(Math.random() * 20) + 81;                      // 81-100 บาท (5%)
}

client.on(Events.MessageCreate, async message => {
    if (message.content.trim() === '!help') {
        return message.reply(`📜 คำสั่งที่ใช้ได้ในบอท:

!balance - เช็คเงินและ Karma ของคุณ
!work - เริ่มภารกิจตอบคำถามเพื่อหาเงิน
!answer <คำตอบ> - ตอบคำถามที่ถูกสุ่มมา
!transfer @user <จำนวน> - โอนเงินให้ผู้ใช้อื่น
!steal @user - ขโมยเงินจากผู้ใช้ (วันละ 5 ครั้ง, มีความเสี่ยง)
!help - แสดงรายการคำสั่งทั้งหมด

💡 คำเตือน:
- Karma ต่ำกว่า 20 มีโอกาสทำงานไม่สำเร็จ 20%
- ทุกการขโมยจะลด Karma ลง 5
- ตอบถูกใน !answer จะได้รางวัลสุ่มและ Karma +1
Version: 0.0.1 bata`);
    }
    if (message.author.bot) return;

    const [cmd, ...args] = message.content.trim().split(' ');

    if (cmd === '!balance') {
        const balance = getBalance(message.author.id);
        const karma = getKarma(message.author.id);
        message.reply(`💰 คุณมี ${balance} บาท | 🧭 Karma: ${karma}`);

    } else if (cmd === '!work') {
        if (globalMathChallenge) {
            return message.reply('🧠 มีคำถามอยู่แล้ว! ตอบคำถามให้เสร็จก่อนโดยใช้ !answer คำตอบของคุณ');
        }

        const karma = getKarma(message.author.id);
        if (karma < 20 && Math.random() < 0.2) {
            return message.reply('😞 Karma ของคุณต่ำเกินไป และคุณไม่ได้รับโอกาสทำงานในครั้งนี้');
        }

        const { question, answer } = generateHardMathQuestion();
        globalMathChallenge = { answer };
        message.channel.send(`🧠 ใครตอบคำถามนี้ได้ก่อน จะได้รับรางวัล!
${question}
ใช้คำสั่ง: !answer คำตอบของคุณ`);

    } else if (cmd === '!answer') {
        const userAnswer = parseInt(args[0]);

        if (!globalMathChallenge) {
            return message.reply('❗ ยังไม่มีคำถามตอนนี้');
        }

        if (userAnswer === globalMathChallenge.answer) {
            const earned = getWeightedRandomReward();
            addBalance(message.author.id, earned);
            updateKarma(message.author.id, 1);
            globalMathChallenge = null;

            let bonusMessage = `✅ ถูกต้อง! คุณได้รับ ${earned} บาท`;
            if (earned >= 80) {
                bonusMessage += ` 🎉 โบนัสใหญ่! คุณสุดยอดมาก!`;
            }
            message.reply(bonusMessage);
        } else {
            message.reply('❌ ผิดนะ ลองอีกครั้ง (หรือให้เพื่อนตอบก็ได้นะ!)');
        }

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

    } else if (cmd === '!steal') {
        const target = message.mentions.users.first();
        if (!target || target.id === message.author.id) {
            return message.reply('❌ ต้องระบุผู้ใช้ที่คุณต้องการขโมย และห้ามขโมยตัวเอง!');
        }

        const today = new Date().toISOString().slice(0, 10);
        const key = `${message.author.id}-${today}`;
        const attempts = stealAttempts.get(key) || 0;

        if (attempts >= 5) {
            return message.reply('❌ วันนี้คุณขโมยครบ 5 ครั้งแล้ว ลองใหม่พรุ่งนี้!');
        }

        stealAttempts.set(key, attempts + 1);

        const success = Math.random() < 0.5;
        const targetBalance = getBalance(target.id);

        if (success && targetBalance > 0) {
            const stolenAmount = Math.floor(Math.random() * (targetBalance * 0.1));
            addBalance(target.id, -stolenAmount);
            addBalance(message.author.id, stolenAmount);
            updateKarma(message.author.id, -5);
            message.reply(`🦹 คุณขโมย ${stolenAmount} บาทจาก ${target.username} สำเร็จ! แต่ Karma ลดลง 5`);
        } else {
            updateKarma(message.author.id, -5);
            message.reply(`😓 ขโมยไม่สำเร็จ... Karma ของคุณลดลง 5`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
