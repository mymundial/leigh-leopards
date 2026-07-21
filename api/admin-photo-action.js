import { handleAdminPhotoAction } from '../server/admin-api.mjs';

export default async function handler(req, res) {
  await handleAdminPhotoAction(req, res, process.env);
}
