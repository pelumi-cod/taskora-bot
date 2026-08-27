require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const https = require('https');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process',
            '--disable-extensions',
            '--disable-component-update',
            '--disable-background-networking',
            '--js-flags="--max-old-space-size=256"'
        ]
    }
});

const userSessions = {};

client.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ---');
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
    console.log('\n👉 OPEN THIS URL IN A NEW BROWSER TAB TO SCAN:\n' + qrImageUrl + '\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(' Taskora WhatsApp Bot is online and ready!');
});


const downloadWithTimeout = (msg, timeoutMs = 15000) => {
    return Promise.race([
        msg.downloadMedia(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Media download timed out')), timeoutMs)
        )
    ]);
};

client.on('message', async (message) => {
    if (message.from.endsWith('@g.us') || message.isStatus) return;

    const userId = message.from;
    const text = message.body ? message.body.trim() : '';

  
    if (text.includes("New Service Request")) {
        userSessions[userId] = {
            step: 'AWAITING_MEDIA',
            payload: text,
            data: {}
        };

        await message.reply(
            "👋 Welcome to ProzLink Services!.\n\n" +
            "Your trusted connection to professionals for emergency and scheduled services.  we'll help  you get a trusted and professional service provider to get it done.\n\n" +
            "To help us match the right technician, please reply with a short **video and clear photo** showing the issue in detail."
        );
        return;
    }

    const session = userSessions[userId];
    if (!session) return;

    if (session.step === 'AWAITING_MEDIA') {
        if (message.hasMedia) {
            await message.reply("Downloading media, please wait...");

            try {
                const media = await downloadWithTimeout(message, 15000);

                if (media && media.data) {
                    const uploadsDir = path.join(__dirname, 'uploads');
                    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

                    let ext = 'mp4';
                    if (media.mimetype) {
                        const parts = media.mimetype.split('/')[1];
                        if (parts) ext = parts.split(';')[0];
                    }

                    const fileName = `${userId.replace('@c.us', '')}_${Date.now()}.${ext}`;
                    const filePath = path.join(uploadsDir, fileName);

                    fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
                    session.data.mediaPath = filePath;

                    session.step = 'AWAITING_ACCESS';
                    await message.reply(
                        "Media saved! \n\n" +
                        "Quick question: Is the issue easily accessible, or will the technician need special equipment or tools?"
                    );
                } else {
                    throw new Error("Received empty media payload.");
                }
            } catch (error) {
                console.error(" Downloader error caught:", error.message);
                

                session.data.mediaPath = `Customer uploaded media (${message.type}), file stream saved on phone chat history.`;
                session.step = 'AWAITING_ACCESS';

                await message.reply(
                    "Media registered! 📸\n\n" +
                    "Moving to the next step: Is the issue easily accessible, or will special tools/ladders be required?"
                );
            }
        } else if (text.toLowerCase() === 'skip') {
            session.data.mediaPath = 'Skipped by customer';
            session.step = 'AWAITING_ACCESS';
            await message.reply("Skipped media upload.\n\nIs the issue easily accessible, or will special tools/ladders be required?");
        } else {
            await message.reply("Please attach a video/photo of the issue, or reply 'skip' to continue.");
        }
        return;
    }

    if (session.step === 'AWAITING_ACCESS') {
        session.data.accessInfo = text;
        session.step = 'COMPLETED';

        const logEntry = 
            `=========================================\n` +
            `DATE/TIME: ${new Date().toLocaleString()}\n` +
            `CUSTOMER WHATSAPP: ${userId}\n` +
            `FORM DETAILS:\n${session.payload}\n` +
            `ACCESS DETAILS: ${session.data.accessInfo}\n` +
            `SAVED MEDIA PATH: ${session.data.mediaPath || 'None'}\n` +
            `=========================================\n\n`;

        fs.appendFileSync('jobs.txt', logEntry, 'utf8');
        console.log(`\n Saved complete job record to jobs.txt for ${userId}`);

        await message.reply(
            "Thank you! Your request details are fully recorded. 🛠️\n\n" +
            "We are matching you with the best available provider now. We'll get back to you shortly!"
        );
    }
});

client.initialize();