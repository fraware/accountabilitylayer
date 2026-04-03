const mongoose = require('mongoose');

before(async function () {
  const uri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/accountability-test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  }
});

after(async function () {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});
