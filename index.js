
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const checkDiskSpace = require("check-disk-space").default;
const { exec } = require("child_process");
const util = require("util");
const { myphone } = require("./config.js");
const execPromise = util.promisify(exec);

const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

const deletedMessagesCache = new Map();
const MAX_CACHE_SIZE = 1000;

function generateMessageKey(message) {
  const timestamp = message.timestamp; 
  const sender = message.from;
  return `${timestamp}-${sender}`;
}

client.on("ready", () => {
  console.log("Client is ready!");
});
function parseMessage(message) {
    if (!message || message.trim() === "") {
      return { command: null, args: [] };
    }
  
    const parts = message.trim().split(/\s+/);
  
    const command = parts[0].startsWith("!") ? parts[0].slice(1).toLowerCase() : parts[0].toLowerCase();
  
    const args = parts.slice(1);
  
    return { command, args };
  }
  function parseMessage2(message) {
  if (!message || message.trim() === "") {
    return { command: null, args: "" };
  }

  const commandStartIndex = message.indexOf("!") + 1;

  const commandEndIndex = message.indexOf(" ", commandStartIndex);

  const command = commandEndIndex === -1 
    ? message.slice(commandStartIndex).toLowerCase() 
    : message.slice(commandStartIndex, commandEndIndex).toLowerCase();

  const args = message.slice(commandEndIndex + 1).trim();

  return { command, args };
}
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.initialize();

client.on("message_create", async (message) => {
	const senderNumber = message.from;
	const contact = await message.getContact();
	const senderName = contact.name || senderNumber; 
	console.log(senderNumber);
  try {
    if ("" + message.from == myphone + "@c.us" && "" + message.to == myphone + "@c.us") {
      console.log(message);
      if (message.body === "!depolama") {
        const storageReport = await generateStorageReport();
        await message.reply(storageReport);
        return;
      } else if (message.body.startsWith("!mesajlar")) {
        const args = message.body.slice("!mesajlar".length).trim().split(/ +/);
        const numara = args[0];
        const gün = args[1];
        if (!numara || !gün) {
          message.reply("Girilen veriler yanlış! syntax: !mesajlar (numara) (gün: 2025-07-07)");
          return;
        }
        const whatsappMessagesDir = "whatsapp_messages";
        const messagesFile = "messages.json";
        const numarapath = path.join(whatsappMessagesDir, numara + "@c.us");
        const tarihpath = path.join(numarapath, gün);
        const messagesFilePath = path.join(tarihpath, messagesFile);
        if (!fs.existsSync(numarapath) || !fs.existsSync(tarihpath)) {
          message.reply("Klasörler bulunamadı.");
          return;
        }
        try {
          const messagesData = JSON.parse(fs.readFileSync(messagesFilePath, "utf-8"));

          const messagesText = JSON.stringify(messagesData, null, 2);

          const txtFilePath = path.join(tarihpath, "messages.txt");
          fs.writeFileSync(txtFilePath, messagesText);

          console.log("messages.json dosyası messages.txt olarak kaydedildi.");
          const media = MessageMedia.fromFilePath(txtFilePath);
          const mesaj = "İşte istediğiniz dosya!";
          message.reply(media, undefined, { caption: mesaj }).then(() => {
            fs.unlink(txtFilePath, (err) => {
              if (err) {
                console.error("Dosya silinirken hata:", err);
              } else {
                console.log("Dosya başarıyla silindi!");
              }
            });
          });

          console.log(txtFilePath);
        } catch (err) {
          message.reply("Bir sorun oluştu :(");
          console.error("Hata oluştu:", err);
        }
      }
      return;
    }
	
    let messageData = { ...message._data };

    if (message.hasMedia) {
      const media = await message.downloadMedia();
      if (media) {	
        const extension = media.mimetype.split("/")[1]; 

        let filename = `${message.timestamp}.${extension}`;

        const sender = message.from;
        const today = new Date();
        const year = today.getFullYear();
        const month = ("0" + (today.getMonth() + 1)).slice(-2);
        const day = ("0" + today.getDate()).slice(-2);
        const formattedDate = `${year}-${month}-${day}`;

        const baseDir = path.join("whatsapp_messages", sender);
        const todayDir = path.join(baseDir, formattedDate);
        const srcDir = path.join(todayDir, "src");

        fs.mkdirSync(baseDir, { recursive: true });
        fs.mkdirSync(todayDir, { recursive: true });
        fs.mkdirSync(srcDir, { recursive: true });

        const filePath = path.join(srcDir, filename); 
        
        fs.writeFileSync(filePath, media.data, { encoding: "base64" });

        messageData.media = {
          type: media.mimetype,
          filename,
          path: filePath, 
        };
      }
    }

    const messageKey = generateMessageKey(message);
    deletedMessagesCache.set(messageKey, messageData);
    if (deletedMessagesCache.size > MAX_CACHE_SIZE) {
      deletedMessagesCache.delete(deletedMessagesCache.keys().next().value);
    }

    await saveMessage(message);
  } catch (err) {
    console.log(err);
  }
});

client.on("message_revoke_everyone", async (message) => {
  try {
    const approximateTimestamp = message.timestamp;
    const sender = message.from;

    const candidateMessages = Array.from(deletedMessagesCache.entries())
      .filter(([key, msg]) => {
        const messageTimestamp = parseInt(key.split('-')[0]);
        return Math.abs(messageTimestamp - approximateTimestamp) <= 5;
      })
      .map(([key, msg]) => msg);

    const deletedMessage = candidateMessages.find(msg => msg.from === sender);

    if (deletedMessage) {
      console.log("Silinen Mesaj:", deletedMessage.body);
      if (deletedMessage.media) {
        console.log("Silinen Mesaj Medyası:", deletedMessage.media);

        const oggFilename = deletedMessage.media.filename;
        const oggFilePath = deletedMessage.media.path;

        const mp3Filename = oggFilename.replace('.ogg; codecs=opus', '.mp3');
        const mp3FilePath = oggFilePath.replace('.ogg; codecs=opus', '.mp3');

        const deletedMediaPath = "C:/xampp/htdocs/deleted_media";
        fs.mkdirSync(deletedMediaPath, { recursive: true });
        const newFilePath = path.join(deletedMediaPath, mp3Filename);

        if (fs.existsSync(mp3FilePath)) {
          fs.renameSync(mp3FilePath, newFilePath);
        } else {
          console.error("Taşınacak .mp3 dosyası bulunamadı:", mp3FilePath);
        }

        deletedMessage.media.path = newFilePath;
        deletedMessage.media.filename = mp3Filename;
        deletedMessage.media.type = "audio/mpeg";
      }

      await saveDeletedMessage(deletedMessage);

      const messageKey = generateMessageKey(deletedMessage);
      deletedMessagesCache.delete(messageKey);
    } else {
      console.log("Mesaj hafızada bulunamadı. Eski bir mesaj olabilir.");
    }
  } catch (err) {
    console.error("Mesaj silme işlemi sırasında hata oluştu:", err);
  }
});
async function saveMessage(message) {
  const sender = message.from;
  const isGroup = message.isGroupMsg;

  let author;
  if (isGroup) {
    try {
      const contact = await message.getContact();
      author = contact.id.user;
    } catch (error) {
      console.error("Gönderen kişi bilgisi alınamadı:", error);
      author = undefined;
    }
  } else {
    author = sender;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = ("0" + (today.getMonth() + 1)).slice(-2);
  const day = ("0" + today.getDate()).slice(-2);
  const formattedDate = `${year}-${month}-${day}`;
  console.log("sa");
  let baseDir;
  if (sender == myphone+"@c.us"){
    baseDir = path.join("whatsapp_messages", message.to);
    console.log(`1message to: ${message.to} message from: ${message.from}`)
  }else {
	  console.log(`2message to: ${message.to} message from: ${message.from}`)
    baseDir = path.join("whatsapp_messages", sender);
  }
  
  const todayDir = path.join(baseDir, formattedDate);
  const srcDir = path.join(todayDir, "src");
  const messagesFile = path.join(todayDir, "messages.json");

  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(todayDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  let messages = [];
  try {
    messages = JSON.parse(fs.readFileSync(messagesFile, "utf-8"));
  } catch (err) {}

  const timestamp = new Date(message.timestamp * 1000);
  const formattedTimestamp = timestamp.toLocaleString();
  let newMessage;
  console.log(message._data.notifyName);
  if (message.pollOptions) {
    newMessage = {
      timestamp: message.timestamp + " (" + formattedTimestamp + ")",
      messageid: message.id.id,
      realaythor: message.author,
      name: message._data.notifyName || "yokki",
      author,
      body: message.body,
      secenekler: message.pollOptions,
    };
  } else {
    newMessage = {
      timestamp: message.timestamp + " (" + formattedTimestamp + ")",
      messageid: message.id.id,
      realaythor: message.author,
      name: message._data.notifyName || "yokki",
      author,
      body: message.body,
    };
  }

  if (message.hasMedia) {
    const media = await message.downloadMedia();
    if (media) {
      if (media.mimetype === "audio/ogg; codecs=opus") {
        const mp3Filename = `${message.timestamp}.mp3`;
        const mp3FilePath = path.join(srcDir, mp3Filename);

        try {
          const tempOggFilename = `${message.timestamp}_temp.ogg`;
          const tempOggFilePath = path.join(srcDir, tempOggFilename);
          fs.writeFileSync(tempOggFilePath, media.data, { encoding: "base64" });

          await execPromise(`ffmpeg -i "${tempOggFilePath}" "${mp3FilePath}"`);

          fs.unlinkSync(tempOggFilePath);

          const mp3Data = fs.readFileSync(mp3FilePath, { encoding: 'base64' });

          newMessage.media = {
            type: "audio/mpeg",
            filename: mp3Filename,
            path: mp3FilePath,
            data: mp3Data 
          };

          messages.push(newMessage);
          fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
        } catch (error) {
          console.error("ffmpeg dönüştürme hatası:", error);
        }
      } else {
        const extension = media.mimetype.split("/")[1]; 
        let filename = `${message.timestamp}.${extension}`;
        const filePath = path.join(srcDir, filename);
        fs.writeFileSync(filePath, media.data, { encoding: "base64" });

        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
          newMessage.media = {
            type: media.mimetype,
            filename,
            path: filePath 
          };
          messages.push(newMessage);
          fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
        } else {
          console.error("Medya dosyası indirilemedi veya kaydedilemedi:", filename);
        }
      }
    }
  } else {
    messages.push(newMessage);
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
  }
}

async function getDeletedMessageInfo(message) {
  const sender = message.from;
  const today = new Date();
  const year = today.getFullYear();
  const month = ("0" + (today.getMonth() + 1)).slice(-2);
  const day = ("0" + today.getDate()).slice(-2);
  const formattedDate = `${year}-${month}-${day}`;

  const messagesFile = path.join("whatsapp_messages", sender, formattedDate, "messages.json");

  if (fs.existsSync(messagesFile)) {
    const messagesData = JSON.parse(fs.readFileSync(messagesFile, "utf-8"));
    const deletedMessage = messagesData.find(msg => msg.messageid === message.id.id);
    return deletedMessage;
  }

  return null;
}

async function saveDeletedMessage(deletedMessage) {
  const deletedMessagesFile = path.join("whatsapp_messages", "deleted_messages.json");

  let deletedMessages = [];
  try {
    deletedMessages = JSON.parse(fs.readFileSync(deletedMessagesFile, "utf-8"));
  } catch (err) {}

  deletedMessages.push(deletedMessage);
  fs.writeFileSync(deletedMessagesFile, JSON.stringify(deletedMessages, null, 2));
  console.log("Silinen mesaj deleted_messages.json dosyasına kaydedildi.");
}

async function generateStorageReport() {
  const baseDir = path.join("whatsapp_messages");
  const driveLetter = process.platform === "win32" ? "C:" : "/";

  const diskSpace = await checkDiskSpace(driveLetter);

  const usedSpaceInGB = (diskSpace.size / (1024 * 1024 * 1024)).toFixed(2);
  const freeSpaceInGB = (diskSpace.free / (1024 * 1024 * 1024)).toFixed(2);
  const freeSpaceString =
    freeSpaceInGB >= 1
      ? `${freeSpaceInGB} GB`
      : `${(diskSpace.free / (1024 * 1024)).toFixed(2)} MB`;

  const folderSizeInBytes = getFolderSize(baseDir);
  const folderSizeString =
    folderSizeInBytes >= 1024 * 1024 * 1024
      ? `${(folderSizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      : `${(folderSizeInBytes / (1024 * 1024)).toFixed(2)} MB`;

  const report = `
Depolama Kullanım Raporu:

Toplam Alan: ${usedSpaceInGB} GB
Kullanılan Alan: ${(diskSpace.size / (1024 * 1024 * 1024) - freeSpaceInGB).toFixed(2)} GB
Kalan Alan: ${freeSpaceString}
WhatsApp Arşiv Boyutu: ${folderSizeString}
    `;

  return report;
}

function getFolderSize(dirPath) {
  let totalSize = 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      totalSize += getFolderSize(filePath);
    }
  }
  return totalSize;
}
