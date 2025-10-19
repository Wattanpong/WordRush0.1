import mongoose from "mongoose";

const wordSchema = new mongoose.Schema(
  {
    term:  { type: String, required: true, trim: true },
    level: { type: String, enum: ["easy", "normal", "hard"], required: true },
    hint:  { type: String, default: "" },
  },
  { timestamps: true }
);

// ป้องกันซ้ำ (คำเดียวกัน + ระดับเดียวกัน)
wordSchema.index({ term: 1, level: 1 }, { unique: true });

export const Word = mongoose.model("Word", wordSchema);
