const http = require('http');
const fs = require('fs');
const logFile = './logs/events.log';

const PORT = 4444;

let events = [];

const logStream = fs.createWriteStream(logFile, {
  flags: 'a'
});

if (fs.existsSync(logFile)) {
  const logs = fs.readFileSync(logFile).toString();
  events = logs.split('\n').filter(event => event.length > 0);
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-headers', '*');
    res.setHeader('access-control-allow-origin', '*');
    return res.end();
  }

  if (req.method === 'POST') {
    let body = [];
    req.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
       body = Buffer.concat(body).toString();
       events = [...events, JSON.parse(body)];

       logStream.write(body + '\n');

       res.setHeader('access-control-allow-headers', '*');
       res.setHeader('access-control-allow-origin', '*');
       res.end(JSON.stringify(events));
    });
    return;
  }

  res.end('Hello client, this is log server');
}).listen(PORT, '0.0.0.0', () => {
  console.log('Started Log server on port %s', PORT);
});


