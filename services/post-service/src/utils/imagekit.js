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
 * @param {string} fileName   - unique name (use generateImageKitFileName)
 * @returns {Promise<string>} - the CDN URL of the uploaded image
 */
export const uploadToImageKit = (buffer, fileName) =>
  new Promise((resolve, reject) => {
   
      imagekit.upload(
        {
          file: buffer.toString('base64'),
          fileName,
          folder: '/posts',
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
        resolve(result.url);
      }
    );
  });

export default imagekit;