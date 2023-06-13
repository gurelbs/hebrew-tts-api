const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();
const app = express();

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const timeout = miliseconds => new Promise(r => setTimeout(r, miliseconds));

const getBrowser = async () => {
  if (IS_PRODUCTION) {
    return puppeteer.connect({
      browserWSEndpoint: process.env.browserWSEndpoint});
  } else {
    return puppeteer.launch({ headless: "new" });
  }
};

app.use((req, res, next) => {
  if (req.path !== '/api') {
    return res.redirect('/api');
  }
  next();
});

app.get('/api', async (req, res) => {
  let browser = null;
  let audioBuffer = null;
  const q = req.query.q?.toString();

  if (!q) {
    let fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    return res.send(`<p>please add a query.<br>for example:<kbd style="background:#222;color:#eee;padding:3px">${fullUrl.concat('?q=hello world')}</kbd></p>`);
  }

  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("translate.google.com/translate_tts")) {
        const buffer = await response.buffer();
        audioBuffer = buffer;
        console.info("Audio buffer scraped successfully.");
      }
    });

    await page.goto(process.env.ttsPrefixUrl+q);
    while (!audioBuffer) await timeout(0);

    const audioPath = path.join(process.cwd(), "records", "audio.mp3");
    await fs.mkdir(path.dirname(audioPath), { recursive: true });
    await fs.writeFile(audioPath, audioBuffer);
    console.info("Audio file saved successfully.");

    res.status(200).sendFile(audioPath);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(400).send("An error occurred.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});


// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Internal Server Error");
});


app.listen(process.env.PORT || 3000, () => console.log("Listening on http://localhost:3000"));
