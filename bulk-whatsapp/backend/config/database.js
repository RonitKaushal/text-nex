const mongoose = require("mongoose");
const connectDB = async () => {
  return new Promise((resolve, reject) => {
    try {
      mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      var db = mongoose.connection;

      db.on("error", function (err) {
        console.log("MongoDB connection FAIL:", err);
        reject(err);
      });

      db.once("open", async function () {
        console.log("MongoDB connection SUCCESS");
        try {
          resolve(true);
        } catch (error) {
          console.error("Error during WhatsApp session restoration:", error);
          resolve(false); 
        }
      });
    } catch (error) {
      console.error("MongoDB connection Catch Error", error);
      resolve(false);
    }
  });
};

module.exports = connectDB;
