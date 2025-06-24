const express = require("express");
const puppeteer = require('puppeteer');
require("dotenv").config();

const app = express();
app.use(express.json()); // Parse JSON body

const PORT = process.env.PORT || 4000;

app.post("/genlove", async (req, res) => {
    const { email, password, prompt } = req.body;
    console.log('DEBUG:', { email, password, prompt }); // <--- Add this
    if (!email || !password || !prompt) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({ 
            executablePath: puppeteer.executablePath(), 
            headless: true, 
            args: [
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--single-process",
            "--no-zygote",
        ],
        });
        const page = await browser.newPage();
    // 1. Login
        await page.goto('https://lovable.dev/login', { waitUntil: 'domcontentloaded' });
    // Wait for and fill email field

        await page.waitForSelector('#email', { visible: true });
        await page.focus('#email');
        await page.evaluate(() => document.getElementById('email').value = '');
        await page.type('#email', email, { delay: 50 });

        // Wait for and fill password field
        await page.waitForSelector('#password', { visible: true });
        await page.focus('#password');
        await page.evaluate(() => document.getElementById('password').value = '');
        await page.type('#password', password, { delay: 50 });


        // Click the "Log in" button
        await page.waitForSelector('button', { visible: true });
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const txt = await page.evaluate(el => el.innerText.trim(), btn);
            if (/^log in$/i.test(txt)) {
            await btn.click();
            break;
            }
        }

    // 2. Wait for the chat input to appear
        await page.waitForSelector('textarea#chatinput', { visible: true });

        // 3. Focus and type the entire prompt, no manual timeouts
        await page.focus('textarea#chatinput');
        await page.type('textarea#chatinput', prompt, { delay: 30 });

        // Click submit
        await page.waitForSelector('button#chatinput-send-message-button', { visible: true });
        await page.click('button#chatinput-send-message-button');

        // 4. Wait for project page to load (unlimited time loop)
        await page.waitForFunction(
            () => window.location.pathname.startsWith('/projects/'),
            { timeout: 0 }
        );
        // Save the project route for error recovery
        let projectRoute = await page.evaluate(() => window.location.pathname);

        // 5. Loop until the preview link appears and print it
        let previewUrl = null;
        while (!previewUrl) {
            // Look for a link that contains 'preview-' in the href
            previewUrl = await page.$$eval('a', els =>
            (els.map(el => el.href).filter(href => href && href.includes('preview-')))[0] || null
            );
            if (previewUrl) {
                console.log('✅ Preview URL:', previewUrl);
                break;
            }
        // Wait 3 seconds before trying again
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
        res.json({ previewUrl, projectRoute });
    } catch (err) {
        if (browser) await browser.close();
        res.status(500).json({ error: err.message });
    } finally{
        await browser.close();
    }

})

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)

})