const mongoose = require("mongoose");

let connectionPromise;

async function connectDB() {
  if (connectionPromise) {
    return connectionPromise;
  }

  mongoose.set("strictQuery", true);

  connectionPromise = mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000
  });

  await connectionPromise;
  console.log("MongoDB connected", mongoose.connection.host, mongoose.connection.name);
  return mongoose.connection;
}

module.exports = connectDB;
