require("dotenv").config();
const { google } = require("googleapis");
const base64 = require("base-64");

const KEY_FILE = "./serviceAccount.json";
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const QUERY = "Wealthsimple verification code";

exports.getCodeFromGmail = async () => {
  await sleep(10000); // give gmail a chance to recieve the OTP

  const gmail = await gmailAuth();

  const msgRef = await getMsgRef(gmail);
  const msg = await getMsgContent(gmail, msgRef);
  const code = findCodeInMsg(msg);

  return code;
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gmailAuth() {
  const JWT = google.auth.JWT;
  const authClient = new JWT({
    keyFile: KEY_FILE,
    scopes: SCOPES,
    subject: process.env.GMAIL_ADDRESS,
  });

  await authClient.authorize();

  return google.gmail({
    auth: authClient,
    version: "v1",
  });
}

async function getMsgRef(gmail) {
  return await gmail.users.messages
    .list({
      userId: process.env.GMAIL_ADDRESS,
      maxResults: 1,
      q: QUERY,
    })
    .catch((e) => {
      console.error(e);
    });
}

async function getMsgContent(gmail, msgRef) {
  return await gmail.users.messages
    .get({
      userId: process.env.GMAIL_ADDRESS,
      id: msgRef.data.messages[0].id,
    })
    .catch((e) => {
      console.error(e);
    });
}

function findCodeInMsg(msg) {
  const body = msg.data.payload.parts[0].body.data;
  let htmlBody = base64.decode(body.replace(/-/g, "+").replace(/_/g, "/"));
  const code = htmlBody.match(/\d{6}/g)[0];

  return code;
}
