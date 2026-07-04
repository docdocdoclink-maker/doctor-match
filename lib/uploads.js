import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./dataDir";

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXT = [".pdf", ".png", ".jpg", ".jpeg"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function saveUpload(file) {
  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error("対応していないファイル形式です（PDF, PNG, JPEGのみ）");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_SIZE) {
    throw new Error("ファイルサイズは10MBまでです");
  }
  const storedName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);
  return { storedName, originalName: file.name };
}

export function readUpload(storedName) {
  const safeName = path.basename(storedName);
  const filePath = path.join(UPLOAD_DIR, safeName);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}
