/**
 * Utility functions for handling product images across Client application.
 * Supports:
 * - Legacy Firebase Storage image URLs
 * - Newly uploaded MongoDB images (served via Express API endpoint)
 * - Future images
 * - Graceful fallback for missing or broken images
 */

export const FALLBACK_IMAGE = '/no-image.svg';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '');

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
    raw = (img.url || img.src || img.data || '').trim();
  }

  if (!raw) return FALLBACK_IMAGE;

  // If it's a mongodb:// URI (e.g. mongodb://6adf...)
  if (raw.startsWith('mongodb://')) {
    const id = raw.replace('mongodb://', '');
    return API_BASE ? `${API_BASE.replace(/\/$/, '')}/images/${id}` : `/api/images/${id}`;
  }

  // If it's an ObjectId string (24 hex characters)
  if (/^[0-9a-fA-F]{24}$/.test(raw)) {
    return API_BASE ? `${API_BASE.replace(/\/$/, '')}/images/${raw}` : `/api/images/${raw}`;
  }

  // If it starts with /api/images
  if (raw.startsWith('/api/images')) {
    return API_BASE ? `${API_BASE.replace(/\/api\/?$/, '')}${raw}` : raw;
  }

  // If it's an HTTP/HTTPS URL (Firebase, Render, Cloud, etc.)
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
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
