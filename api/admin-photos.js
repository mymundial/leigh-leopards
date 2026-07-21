import { handleAdminPhotos } from '../server/admin-api.mjs';

export default async function handler(req, res) {
  await handleAdminPhotos(req, res, process.env);
}
