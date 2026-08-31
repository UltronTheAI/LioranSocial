import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

export const isCloudinaryConfigured = Boolean(
  CLOUDINARY_CLOUD_NAME &&
  CLOUDINARY_API_KEY &&
  CLOUDINARY_API_SECRET &&
  !CLOUDINARY_CLOUD_NAME.includes('<') &&
  !CLOUDINARY_API_KEY.includes('<')
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Uploads a Buffer directly to Cloudinary via upload_stream
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  folder: string = 'lioransocial/avatars',
  options: { transformation?: string; public_id?: string } = {}
): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured) {
    // In dev fallback mode if Cloudinary is not configured yet
    const base64Data = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    return {
      public_id: `dev_${Date.now()}`,
      version: 1,
      signature: 'dev_mock_signature',
      width: 400,
      height: 400,
      format: 'jpeg',
      resource_type: 'image',
      created_at: new Date().toISOString(),
      tags: [],
      bytes: buffer.length,
      type: 'upload',
      etag: 'dev_mock_etag',
      placeholder: false,
      url: base64Data,
      secure_url: base64Data,
      access_mode: 'public',
      original_filename: 'avatar',
    } as unknown as UploadApiResponse;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Upload to Cloudinary failed'));
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Generates an optimized Cloudinary delivery URL with face detection and crop
 */
export function getOptimizedAvatarUrl(urlOrPublicId: string, size: number = 300): string {
  if (!urlOrPublicId) return '';
  if (urlOrPublicId.startsWith('data:') || !isCloudinaryConfigured) {
    return urlOrPublicId;
  }

  if (urlOrPublicId.startsWith('http://') || urlOrPublicId.startsWith('https://')) {
    // Insert transformation parameters before /v[0-9]+/ or /upload/
    if (urlOrPublicId.includes('/upload/')) {
      return urlOrPublicId.replace(
        '/upload/',
        `/upload/c_fill,g_face,w_${size},h_${size},q_auto,f_auto/`
      );
    }
    return urlOrPublicId;
  }

  return cloudinary.url(urlOrPublicId, {
    width: size,
    height: size,
    crop: 'fill',
    gravity: 'face',
    fetch_format: 'auto',
    quality: 'auto',
    secure: true,
  });
}

export default cloudinary;
