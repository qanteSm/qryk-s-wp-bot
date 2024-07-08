const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const checkDiskSpace = require("check-disk-space").default;
const { exec } = require("child_process");
const util = require("util");
const { myphone } = require("./config.js")
const execPromise = util.promisify(exec);

const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.initialize();

client.on("message_create", async (message) => {
  try {
    if( ""+message.from == myphone+"@c.us" && ""+message.to == myphone+"@c.us"){
      console.log(message)
      if(message.body === "!depolama"){

        const storageReport = await generateStorageReport();
        await message.reply(storageReport);
        return
      } else if(message.body.startsWith("!mesajlar")) {
        const args = message.body.slice("!mesajlar".length).trim().split(/ +/);
        const numara = args[0]
        const gün = args[1]
        if(!numara || !gün){
          message.reply("Girilen verielr yanlış! syntax: !mesajlar (numara) (gün: 2025-07-07)")
          return;
        }
        const whatsappMessagesDir = "whatsapp_messages";
        const messagesFile = "messages.json";
        const numarapath = path.join(whatsappMessagesDir, numara+"@c.us");
        const tarihpath = path.join(numarapath, gün);
        const messagesFilePath = path.join(tarihpath, messagesFile);
        if (!fs.existsSync(numarapath) || !fs.existsSync(tarihpath)) {
          message.reply("Klasörler bulunamadı.");
          return; 
        }
         const messagesData = JSON.parse(fs.readFileSync(messagesFilePath, 'utf-8'));
        try {
          const messagesData = JSON.parse(
            fs.readFileSync(messagesFilePath, "utf-8")
          );

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
          })
          
          console.log(txtFilePath);
        } catch (err) {
          message.reply("Bİrader json gönderilirken bi sorun oluştu :(")
          console.error("Hata oluştu:", err);
        }

      }
      return;
    }
    console.log(myphone + "@c.us");
    console.log(message.from);
    console.log(message);
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
    const today2 = new Date();
    const options = { year: "numeric", month: "numeric", day: "numeric" };
    const formattedDate = new Intl.DateTimeFormat("tr-TR", options).format(
      today2
    );

    const parts = formattedDate.split("."); 
    const [day, month, year] = parts;
    const formattedDate2 = `${year}-${month}-${day}`;
    const today = formattedDate2;
    console.log(today);
    const baseDir = path.join("whatsapp_messages", sender);
    const todayDir = path.join(baseDir, today);
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
    if (message.pollOptions){
      newMessage = {
        timestamp: message.timestamp + " (" + formattedTimestamp + ")",
        messageid: message.id.id,
        realaythor: message.author,
        name: message.notifyName || "yokki",
        author,
        body: message.body,
        secenekler: message.pollOptions,
      };
    }else {
      newMessage = {
        timestamp: message.timestamp + " (" + formattedTimestamp + ")",
        messageid: message.id.id,
        realaythor: message.author,
        name: message.notifyName || "yokki",
        author,
        body: message.body,
      };
    }
    

    if (message.hasMedia) {
      const media = await message.downloadMedia();
      if (media) {
        let extension = media.mimetype.split("/")[1];
        if (extension === "x-rar-compressed") {
          extension = "rar";
        }
        let filename = `${message.timestamp}.${extension}`;

        const filePath = path.join(srcDir, filename);
        fs.writeFileSync(filePath, media.data, { encoding: "base64" });

        if (media.mimetype === "audio/ogg; codecs=opus") {
          const mp3Filename = `${message.timestamp}.mp3`;
          const mp3FilePath = path.join(srcDir, mp3Filename);

          execPromise(`ffmpeg -i "${filePath}" "${mp3FilePath}"`)
            .then(() => {
              fs.unlinkSync(filePath);

              newMessage.media = {
                type: "audio/mpeg",
                filename: mp3Filename,
              };
              console.log("tureamii");

              messages.push(newMessage);
              console.log("santamaria");
              fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
            })
            .catch((error) => {
              console.error("ffmpeg conversion error:", error);
            });
        } else if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
          newMessage.media = {
            type: media.mimetype,
            filename,
          };
          messages.push(newMessage);
          console.log("santamaria");
          fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
        } else {
          console.error(
            "Media file could not be downloaded or saved:",
            filename
          );
        }
      }
    } else {
      messages.push(newMessage);
      console.log("santamaria");
      fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
    }
  } catch (err) {
    console.log(err);
  }
});


client.on("message_revoke_everyone", async (message) => {
  
});




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
Kullanılan Alan: ${(
    diskSpace.size / (1024 * 1024 * 1024) -
    freeSpaceInGB
  ).toFixed(2)} GB
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