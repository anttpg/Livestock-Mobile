require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const querystring = require('querystring');

let server;
const port = 8000;

if (process.env.HOST_PEM && process.env.HOST_KEY) {
  const options = {
    key: fs.readFileSync(process.env.HOST_KEY),
    cert: fs.readFileSync(process.env.HOST_PEM),
    rejectUnauthorized: true
  };

  server = https.createServer(options, handleRequest);
  console.log(`Server running WITH SSL on https://localhost:${port}`);
} else {
  server = http.createServer(handleRequest);
  console.log(`Server running WITHOUT SSL on http://localhost:${port}`);
}

function handleRequest(req, res) {
  console.log(`[${new Date().toISOString()}] Incoming request: ${req.method} ${req.url}`);

  if (req.method === 'GET' && req.url === '/github-webhook-pull-main') {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(htmlContent);
  }

  if (req.method === 'POST' && req.url === '/github-webhook-pull-main') {
    return handlePost(req, res);
  }

  res.writeHead(404);
  res.end("Not found");
}

function handlePost(req, res) {
  const contentType = req.headers['content-type'];

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    console.log("Webhook/body received.");

    if (contentType === 'application/json') {
      if (!verifySignature(req, body)) {
        console.error("Invalid signature. Rejecting webhook.");
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden: Invalid webhook signature');
      }

      console.log("Valid GitHub signature.");

      try {
        const json = JSON.parse(body);
        console.log("Parsed JSON webhook payload:\n", JSON.stringify(json, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ message: "Webhook accepted" }));
      } catch (e) {
        console.error("JSON parse error:", e);
        res.writeHead(400);
        return res.end("Invalid JSON");
      }
    }

    if (contentType === "application/x-www-form-urlencoded") {
      const parsed = querystring.parse(body);
      console.log("Received test form input:", parsed);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end("Form received");
    }

    console.warn(`Unsupported content type: ${contentType}`);
    res.writeHead(415, { 'Content-Type': 'text/plain' });
    return res.end('Unsupported Content-Type');
  });
}

function verifySignature(req, body) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    console.error("Missing signature header.");
    return false;
  }

  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  hmac.update(body);
  const digest = "sha256=" + hmac.digest('hex');

  console.log("Computed digest:", digest);
  console.log("Received signature:", signature);

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

const htmlContent = `
<!DOCTYPE html>
<html><body>
<h1>Test Input</h1>
<form method="POST" action="/" id="f">
  <input type="text" name="userInput">
  <button type="submit">Send</button>
</form>
</body></html>
`;

server.listen(port);
