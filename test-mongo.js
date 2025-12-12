const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = process.env.MONGODB_URI || (fs.existsSync('.env') && fs.readFileSync('.env','utf8').match(/MONGODB_URI=(.*)/)?.[1]);
console.log('TEST: using URI ->', (uri && uri.length>80 ? uri.slice(0,80)+'...' : uri));
(async () => {
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    await client.connect();
    console.log('TEST: connected OK');
    await client.close();
  } catch (err) {
    console.error('TEST ERROR:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
})();
