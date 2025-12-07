// Quick test script using FormData (like the browser does)
const http = require('http');
const QueryString = require('querystring');

const payload = {
  hostel: 'Ellora',
  mealType: 'breakfast',
  singleItem: 'Idli',
  createdBy: 'TestUser',
};

const postData = QueryString.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/menus',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.setTimeout(5000);

console.log('Sending:', postData);
req.write(postData);
req.end();
