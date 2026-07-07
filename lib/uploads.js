import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./dataDir";

const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
// Same reasoning as lib/db.js: DATA_DIR points at a volume that only exists
// in the real runtime container, not the build container. Don't touch the
// filesystem for this at module load during a production build.
if (process.env.NEXT_PHASE !== "phase-production-build" && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const DEFAULT_ALLOWED_EXT = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xls", ".xlsx"];
export const RESUME_ALLOWED_EXT = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function saveUpload(file, allowedExt = DEFAULT_ALLOWED_EXT) {
  const ext = path.extname(file.name || "").toLowerCase();
  if (!allowedExt.includes(ext)) {
    throw new Error(`対応していないファイル形式です（${allowedExt.join(", ")}のみ）`);
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
