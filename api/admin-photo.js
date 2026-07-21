import { handleAdminPhotoMedia } from '../server/admin-api.mjs';

export default async function handler(req, res) {
  await handleAdminPhotoMedia(req, res, process.env);
}
