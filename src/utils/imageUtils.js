import { API_BASE } from './apiConfig';

/**
 * Utility functions for handling product images across Client application.
 * Supports:
 * - Legacy Firebase Storage image URLs
 * - Newly uploaded MongoDB images (served via Express API endpoint)
 * - Future images
 * - Graceful fallback for missing or broken images
 */

export const FALLBACK_IMAGE = '/no-image.svg';

const getMongoImageUrl = (id) => `${API_BASE.replace(/\/$/, '')}/images/${id}`;

/**
 * Normalizes any image URL or reference.
 * If the image is stored in MongoDB as an ID or relative path or mongodb:// URI,
 * it returns the full API endpoint URL.
 * If it's already an HTTP/HTTPS URL (Firebase, CDN, external), returns it as-is.
 *
 * @param {string|Object} img
 * @returns {string}
 */
export const resolveImageUrl = (img) => {
  if (!img) return FALLBACK_IMAGE;

  let raw = '';
  if (typeof img === 'string') {
    raw = img.trim();
  } else if (typeof img === 'object') {
    const imageReference = img.url || img.src || img.data || img.mainImageUrl || img.imageUrl;
    raw = typeof imageReference === 'string' ? imageReference.trim() : '';
  }

  if (!raw) return FALLBACK_IMAGE;

  // 1. If it's a mongodb:// URI (e.g. mongodb://6adf...)
  const mongoUri = raw.match(/^mongodb:\/\/([0-9a-fA-F]{24})$/);
  if (mongoUri) return getMongoImageUrl(mongoUri[1]);

  // 2. If it's a pure ObjectId string (24 hex characters)
  if (/^[0-9a-fA-F]{24}$/.test(raw)) {
    return getMongoImageUrl(raw);
  }

  // 3. If it contains /api/images/:id anywhere (relative path, localhost URL, 127.0.0.1, or old backend domain)
  const imageMatch = raw.match(/(?:^|https?:\/\/[^/]+)?\/api\/images\/([0-9a-fA-F]{24})(?:[?#].*)?$/i);
  if (imageMatch) {
    return getMongoImageUrl(imageMatch[1]);
  }

  // 4. Data URLs (e.g. base64 preview)
  if (raw.startsWith('data:')) return raw;

  // 5. Any other HTTP/HTTPS URL (Firebase, Cloudinary, S3, etc.)
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsedUrl = new URL(raw);
      const isLoopback = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(parsedUrl.hostname);
      // Fallback check if pathname has 24-hex image ID
      const hexMatch = parsedUrl.pathname.match(/([0-9a-fA-F]{24})/);
      if (isLoopback && hexMatch) {
        return getMongoImageUrl(hexMatch[1]);
      }
    } catch (error) {
      console.error('Unable to resolve image URL:', error);
    }
    return raw;
  }

  return raw;
};

/**
 * Extracts the primary/main image URL from a product document.
 * Checks mainImageUrl, imageUrls array, and legacy image properties.
 *
 * @param {Object} product
 * @returns {string}
 */
export const getProductMainImage = (product) => {
  if (!product) return FALLBACK_IMAGE;

  if (product.mainImageUrl && typeof product.mainImageUrl === 'string' && product.mainImageUrl.trim()) {
    return resolveImageUrl(product.mainImageUrl);
  }

  if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
    const mainObj = product.imageUrls.find((i) => i && (i.isMain === true || i.isMain === 'true'));
    if (mainObj && (mainObj.url || typeof mainObj === 'string')) {
      return resolveImageUrl(mainObj.url || mainObj);
    }
    const first = product.imageUrls[0];
    if (first) {
      return resolveImageUrl(first.url || first);
    }
  }

  if (product.image && typeof product.image === 'string' && product.image.trim()) {
    return resolveImageUrl(product.image);
  }

  if (product.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
    return resolveImageUrl(product.imageUrl);
  }

  return FALLBACK_IMAGE;
};

/**
 * Standard image onError handler to safely show local SVG placeholder without infinite loops
 *
 * @param {Event} e
 */
export const handleImageError = (e) => {
  if (e?.target && !e.target.src.endsWith(FALLBACK_IMAGE)) {
    e.target.onerror = null;
    e.target.src = FALLBACK_IMAGE;
  }
};

export default {
  FALLBACK_IMAGE,
  resolveImageUrl,
  getProductMainImage,
  handleImageError,
};
