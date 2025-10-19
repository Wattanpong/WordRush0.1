// models/User.js (ตัวอย่างสั้น ๆ)
const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: { type: String, default: "user" }
});
module.exports = mongoose.model("User", UserSchema);
