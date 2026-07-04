// Where the SQLite DB and uploaded files live. Locally this defaults to the
// project folder. In production, set DATA_DIR to a Railway volume's mount
// path (e.g. /app/data) so data survives redeploys instead of being wiped
// with the container each time.
export const DATA_DIR = process.env.DATA_DIR || process.cwd();
