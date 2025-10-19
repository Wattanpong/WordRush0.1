// models/TypingBest.js
import mongoose from "mongoose";

const TypingBestSchema = new mongoose.Schema({
  userId: { type: String, index: true, required: true },
  level:  { type: String, enum: ["easy","normal","hard"], index: true, required: true },
  best:   { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
}, { collection: "typing_bests" });

TypingBestSchema.index({ userId: 1, level: 1 }, { unique: true });

export default mongoose.model("TypingBest", TypingBestSchema);
