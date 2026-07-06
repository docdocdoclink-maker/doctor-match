import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { readUpload } from "@/lib/uploads";

export async function GET(request, { params }) {
  const { filename } = await params;
  const session = await getSession();
  if (!session.userId && !session.isAdmin) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  // A file is either a chat attachment (messages.attachment_path) or a
  // signup document (documents.stored_name, e.g. resume/license).
  const message = db.prepare("SELECT * FROM messages WHERE attachment_path = ?").get(filename);
  const document = message ? null : db.prepare("SELECT * FROM documents WHERE stored_name = ?").get(filename);

  if (!message && !document) {
    return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
  }

  let authorized = false;
  let displayName = filename;

  if (message) {
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(message.job_id);
    const isThreadDoctor = session.role === "doctor" && session.userId === message.doctor_user_id;
    const isOwnerHospital = session.role === "hospital" && job && job.hospital_user_id === session.userId;
    authorized = isThreadDoctor || isOwnerHospital || !!session.isAdmin;
    displayName = message.attachment_name || filename;
  } else if (document) {
    // The doctor themself, or an admin reviewing the signup, can always
    // access these. A hospital can too, but only once the doctor has opted
    // in to share documents on at least one conversation with that hospital.
    const sharedWithHospital =
      session.role === "hospital" &&
      db
        .prepare(
          `SELECT 1 FROM conversations c JOIN jobs j ON j.id = c.job_id
           WHERE c.doctor_user_id = ? AND j.hospital_user_id = ? AND c.share_documents = 1 LIMIT 1`
        )
        .get(document.user_id, session.userId);
    authorized = session.userId === document.user_id || !!session.isAdmin || !!sharedWithHospital;
    displayName = document.original_name || filename;
  }

  if (!authorized) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const data = readUpload(filename);
  if (!data) {
    return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(displayName)}"`,
    },
  });
}
