// A stand-in for Resend, for tests. Accepts the same request the API sends, writes each
// email as one line of JSON to the file named by MAIL_LOG, and sends nothing anywhere.
//   node scripts/fake-mail-server.mjs        (port 4199, MAIL_LOG defaults to ./mail.log)
import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";

const port = Number(process.env.MAIL_PORT ?? 4199);
const logFile = process.env.MAIL_LOG ?? "mail.log";
writeFileSync(logFile, "");

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const mail = JSON.parse(body);
      appendFileSync(logFile, JSON.stringify({ to: mail.to, subject: mail.subject, text: mail.text }) + "\n");
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id: "fake" }));
    } catch {
      res.writeHead(400).end();
    }
  });
}).listen(port, () => console.log(`Fake mail server on http://localhost:${port}, writing to ${logFile}`));
