import ImageKit from 'imagekit';
import config from '../config/config.js';

const imagekit = new ImageKit({
  publicKey:   config.IMAGEKIT_PUBLIC_KEY,
  privateKey:  config.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: config.IMAGEKIT_URL_ENDPOINT,
});

/**
 * Upload a single buffer to ImageKit.
 * @param {Buffer} buffer     - file buffer from multer memoryStorage
 * @param {string} fileName   - unique name (use generateAvatarFileName)
 * @param {string} [folder]   - ImageKit folder, defaults to '/avatars'
 * @returns {Promise<{url: string, fileId: string}>}
 */
export const uploadToImageKit = (buffer, fileName, folder = '/avatars') =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      {
        file: buffer.toString('base64'),
        fileName,
        folder,
        useUniqueFileName: false,
      },
      (err, result) => {
        if (err) {
          console.error('ImageKit upload failed:', err);
          return reject(err);
        }
        console.log('ImageKit uploaded:', {
          url: result.url,
          filePath: result.filePath,
          name: result.name,
        });
        // Return fileId too — deleteOldAvatars doesn't strictly need it
        // (it looks files up by name prefix), but it's cheap to expose
        // and lets a future migration store it directly on the User doc
        // for guaranteed O(1) cleanup instead of a search.
        resolve({ url: result.url, fileId: result.fileId });
      }
    );
  });

/**
 * Delete every previous avatar file belonging to this user, except the
 * one just uploaded.
 *
 * Why "list then delete" instead of tracking a fileId on the User model:
 * generateAvatarFileName() already encodes the userId into every avatar
 * filename (`avatar_<userId>_<timestamp>.<ext>`), so ImageKit's own
 * search index is enough to find them — no schema migration needed.
 * If a fileId field gets added to the User model later, swap this for a
 * direct imagekit.deleteFile(oldFileId) call, which is one HTTP round
 * trip instead of two.
 *
 * Called AFTER the new avatar upload succeeds, never before — if this
 * fails, the user still has a working (old) avatar rather than none.
 * Failures here are logged and swallowed, not thrown, so a flaky
 * ImageKit cleanup call never fails the avatar-update request itself.
 *
 * @param {string} userId
 * @param {string} keepFileId - fileId of the avatar that was just uploaded
 */
export const deleteOldAvatars = async (userId, keepFileId) => {
  try {
    const files = await imagekit.listFiles({
      path: '/avatars',
      searchQuery: `name : "avatar_${userId}_*"`,
      limit: 20,
    });

    const toDelete = files.filter((f) => f.fileId !== keepFileId);

    await Promise.all(
      toDelete.map((f) =>
        imagekit.deleteFile(f.fileId).catch((err) => {
          console.error(`Failed to delete old avatar ${f.filePath}:`, err.message || err);
        })
      )
    );

    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} old avatar(s) for user ${userId}`);
    }
  } catch (err) {
    // Never let cleanup failure affect the response — the new avatar is
    // already saved and returned to the client by this point.
    console.error(`deleteOldAvatars lookup failed for user ${userId}:`, err.message || err);
  }
};

export default imagekit;