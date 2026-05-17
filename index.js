const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require("@whiskeysockets/baileys")

const P = require("pino")
const fs = require("fs-extra")
const axios = require("axios")

// ================= SETTINGS =================

const OWNER_NUMBER = "972527066516@s.whatsapp.net"
const PHONE_NUMBER = "9647886281208"

const PREFIX = "."

// ================= DATABASE =================

const DB_FILE = "./users.json"

if (!fs.existsSync(DB_FILE)) {
  fs.writeJsonSync(DB_FILE, {})
}

const loadDB = () => fs.readJsonSync(DB_FILE)
const saveDB = (db) => fs.writeJsonSync(DB_FILE, db)

// ================= START BOT =================

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: ["JO-BOT", "Chrome", "1.0.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  // ================= PAIRING =================

  if (!state.creds.registered) {

    setTimeout(async () => {

      const code =
        await sock.requestPairingCode(PHONE_NUMBER)

      console.log(`
========================
PAIRING CODE: ${code}
========================
`)

    }, 3000)
  }

  // ================= CONNECTION =================

  sock.ev.on("connection.update", (update) => {

    const {
      connection,
      lastDisconnect
    } = update

    if (connection === "open") {
      console.log("BOT ONLINE 🔥")
    }

    if (connection === "close") {

      const reconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (reconnect) {
        startBot()
      }
    }
  })

  // ================= MESSAGE =================

  sock.ev.on("messages.upsert", async ({ messages }) => {

    try {

      const msg = messages[0]

      if (!msg.message) return
      if (msg.key.fromMe) return

      const from = msg.key.remoteJid
      const sender = msg.key.participant || from
      const isGroup = from.endsWith("@g.us")

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        ""

      if (!text.startsWith(PREFIX)) return

      const body = text.slice(PREFIX.length).trim()

      const args = body.split(" ")
      const command = args.shift().toLowerCase()

      const reply = async (t) => {

        await sock.sendMessage(from, {
          text: t,
          mentions: [sender]
        }, {
          quoted: msg
        })
      }

      // ================= DATABASE =================

      let db = loadDB()

      if (!db[sender]) {

        db[sender] = {
          money: 1000,
          bank: 0,
          lastSalary: 0,
          lastDaily: 0
        }

        saveDB(db)
      }

      const user = db[sender]

      // ================= MENU =================

      if (
        command === "menu" ||
        command === "اوامر"
      ) {

        return reply(`
╭──〔 JO BOT 〕──╮

💰 الاقتصاد
• .راتب
• .يومية
• .فلوسي
• .بنك
• .ايداع
• .سحب
• .توب
• .زرف

🎮 الترفيه
• .حب
• .حظ
• .زواج
• .طلاق

🤖 الذكاء
• .جو [سؤال]

📥 التحميل
• .تيك [رابط]
• .انستا [رابط]

🖼️ الملصقات
• .ملصق

👤 العامة
• .بروفايل
• .منشن
• .بنج
• .مطور

╰──────────────╯
`)
      }

      // ================= PING =================

      if (command === "بنج") {
        return reply("🏓 البوت شغال")
      }

      // ================= OWNER =================

      if (command === "مطور") {

        return reply(`
👑 المطور الرسمي

📞 972527066516
`)
      }

      // ================= PROFILE =================

      if (command === "بروفايل") {

        return reply(`
👤 المستخدم:
@${sender.split("@")[0]}

💰 الكاش:
${user.money}

🏦 البنك:
${user.bank}
`)
      }

      // ================= MENTION =================

      if (command === "منشن") {

        if (!isGroup)
          return reply("هذا الأمر للمجموعات فقط")

        const metadata =
          await sock.groupMetadata(from)

        const participants =
          metadata.participants.map(v => v.id)

        return await sock.sendMessage(from, {
          text: "📢 منشن للجميع",
          mentions: participants
        })
      }

      // ================= SALARY =================

      if (command === "راتب") {

        const now = Date.now()

        if (now - user.lastSalary < 7200000) {
          return reply("⏳ انتظر ساعتين")
        }

        const amount =
          Math.floor(Math.random() * 4000) + 1000

        user.money += amount
        user.lastSalary = now

        saveDB(db)

        return reply(`💸 استلمت ${amount}`)
      }

      // ================= DAILY =================

      if (command === "يومية") {

        const now = Date.now()

        if (now - user.lastDaily < 86400000) {
          return reply("📦 استلمت اليومية اليوم")
        }

        const amount =
          Math.floor(Math.random() * 3000) + 500

        user.money += amount
        user.lastDaily = now

        saveDB(db)

        return reply(`📦 اليومية: ${amount}`)
      }

      // ================= MONEY =================

      if (
        command === "فلوسي" ||
        command === "بنك"
      ) {

        return reply(`
💰 الكاش:
${user.money}

🏦 البنك:
${user.bank}
`)
      }

      // ================= DEPOSIT =================

      if (command === "ايداع") {

        const amount = parseInt(args[0])

        if (!amount)
          return reply("اكتب مبلغ")

        if (amount > user.money)
          return reply("فلوسك قليلة")

        user.money -= amount
        user.bank += amount

        saveDB(db)

        return reply("🏦 تم الايداع")
      }

      // ================= WITHDRAW =================

      if (command === "سحب") {

        const amount = parseInt(args[0])

        if (!amount)
          return reply("اكتب مبلغ")

        if (amount > user.bank)
          return reply("الرصيد قليل")

        user.bank -= amount
        user.money += amount

        saveDB(db)

        return reply("💵 تم السحب")
      }

      // ================= STEAL =================

      if (command === "زرف") {

        const amount =
          Math.floor(Math.random() * 1000)

        user.money += amount

        saveDB(db)

        return reply(`🕶️ سرقت ${amount}`)
      }

      // ================= TOP =================

      if (command === "توب") {

        const users = Object.entries(db)

        const top = users
          .sort((a, b) => b[1].money - a[1].money)
          .slice(0, 10)

        let txt = "🏆 أغنى الناس:\n\n"

        top.forEach((u, i) => {

          txt += `${i + 1}. @${u[0].split("@")[0]}
💰 ${u[1].money}

`
        })

        return await sock.sendMessage(from, {
          text: txt,
          mentions: top.map(v => v[0])
        })
      }

      // ================= FUN =================

      if (command === "حب") {

        const love =
          Math.floor(Math.random() * 101)

        return reply(`❤️ نسبة الحب: ${love}%`)
      }

      if (command === "حظ") {

        const luck =
          Math.floor(Math.random() * 101)

        return reply(`🍀 حظك اليوم: ${luck}%`)
      }

      if (command === "زواج") {

        const love =
          Math.floor(Math.random() * 101)

        return reply(`💍 نسبة الزواج: ${love}%`)
      }

      if (command === "طلاق") {

        const love =
          Math.floor(Math.random() * 101)

        return reply(`💔 نسبة الطلاق: ${love}%`)
      }

      // ================= AI =================

      if (command === "جو") {

        const q = args.join(" ")

        if (!q)
          return reply("اكتب سؤال")

        try {

          const r = await axios.get(
            `https://api.simsimi.vn/v2/simtalk?text=${encodeURIComponent(q)}&lc=ar`
          )

          return reply(
            r.data.message ||
            "ما عرفت ارد"
          )

        } catch {

          return reply("الذكاء الصناعي مشغول")
        }
      }

      // ================= TIKTOK =================

      if (command === "تيك") {

        const url = args[0]

        if (!url)
          return reply("حط رابط")

        try {

          const r = await axios.get(
            `https://api.tiklydown.eu.org/api/download?url=${url}`
          )

          const video =
            r.data.video.noWatermark

          await sock.sendMessage(from, {
            video: { url: video },
            caption: "📥 TikTok Downloader"
          }, {
            quoted: msg
          })

        } catch {

          reply("فشل التحميل")
        }
      }

      // ================= INSTAGRAM =================

      if (command === "انستا") {

        const url = args[0]

        if (!url)
          return reply("حط رابط")

        try {

          const r = await axios.get(
            `https://api.neoxr.eu/api/ig?url=${url}`
          )

          const video =
            r.data.data[0].url

          await sock.sendMessage(from, {
            video: { url: video },
            caption: "📥 Instagram Downloader"
          }, {
            quoted: msg
          })

        } catch {

          reply("فشل التحميل")
        }
      }

      // ================= STICKER =================

      if (command === "ملصق") {

        try {

          const quoted =
            msg.message?.extendedTextMessage
              ?.contextInfo?.quotedMessage

          if (!quoted?.imageMessage)
            return reply(
              "رد على صورة واكتب .ملصق"
            )

          const media =
            await downloadMediaMessage(
              {
                message: quoted
              },
              "buffer",
              {},
              {
                logger: P({
                  level: "silent"
                }),
                reuploadRequest:
                  sock.updateMediaMessage
              }
            )

          await sock.sendMessage(from, {
            sticker: media
          }, {
            quoted: msg
          })

        } catch (e) {

          console.log(e)

          reply("فشل صنع الملصق")
        }
      }

    } catch (e) {

      console.log(e)
    }
  })
}

startBot()
