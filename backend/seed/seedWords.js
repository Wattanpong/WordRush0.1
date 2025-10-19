import mongoose from "mongoose";
import dotenv from "dotenv";
import { Word } from "../models/Word.js";

dotenv.config();

const seedData = [
  // easy
  { term: "apple", level: "easy", hint: "ผลไม้สีแดงหรือเขียว" },
  { term: "orange", level: "easy", hint: "ผลไม้สีส้ม" },
  { term: "student", level: "easy", hint: "นักเรียน" },
  // normal
  { term: "practice makes perfect", level: "normal", hint: "ฝึกบ่อยๆ จะเก่ง" },
  { term: "finish your homework", level: "normal", hint: "ทำการบ้านให้เสร็จ" },
  // hard
  { term: "Simplicity is the ultimate sophistication", level: "hard" },
  { term: "Consistency beats intensity in the long run", level: "hard" },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await Word.deleteMany({});
    console.log("🗑 ลบข้อมูลเดิมทั้งหมดแล้ว");

    await Word.insertMany(seedData);
    console.log(`🌱 เพิ่มข้อมูลคำศัพท์ทั้งหมด ${seedData.length} รายการสำเร็จ`);

    mongoose.connection.close();
    console.log("🔌 ปิดการเชื่อมต่อ MongoDB");
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
})();
