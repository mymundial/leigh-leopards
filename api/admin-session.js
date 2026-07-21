import { handleAdminSession } from '../server/admin-api.mjs';

export default async function handler(req, res) {
  await handleAdminSession(req, res, process.env);
}
