import { API_BASE } from '../utils/apiConfig';

const getApiBase = () => {
  if (!API_BASE) {
    throw new Error('VITE_API_URL must be configured for the deployed image backend');
  }
  return API_BASE.replace(/\/$/, '');
};

export const isImageFile = (file) =>
  Boolean(file?.type?.startsWith('image/')) || /\.(jpe?g|png|webp|gif|svg)$/i.test(file?.name || '');

export const uploadImageToMongoDB = async (file, { associatedRecordId = '', productId = '', isMain = false, color = '', role = '' } = {}) => {
  const formData = new FormData();
  formData.append('image', file);
  if (associatedRecordId) formData.append('associatedRecordId', associatedRecordId);
  if (productId) formData.append('productId', productId);
  formData.append('isMain', String(isMain));
  if (color) formData.append('color', color);
  if (role) formData.append('role', role);

  const response = await fetch(`${getApiBase()}/images/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Image upload failed with status ${response.status}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    url: `/api/images/${result.id}`,
    path: `mongodb://${result.id}`,
    name: result.originalName || file.name,
    contentType: result.contentType,
    type: 'mongodb',
    role: result.role,
    storage: 'mongodb',
  };
};

export const getMongoImageId = (imageReference) => {
  if (typeof imageReference !== 'string') return null;
  const value = imageReference.trim();
  const mongoId = value.match(/^mongodb:\/\/([0-9a-fA-F]{24})$/);
  if (mongoId) return mongoId[1];
  const apiId = value.match(/\/api\/images\/([0-9a-fA-F]{24})(?:[?#].*)?$/);
  if (apiId) return apiId[1];
  return /^[0-9a-fA-F]{24}$/.test(value) ? value : null;
};

export const deleteImageFromMongoDB = async (imageId) => {
  const response = await fetch(`${getApiBase()}/images/${imageId}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Image deletion failed with status ${response.status}`);
  }
  return response.json();
};

export const deleteMongoImageReference = async (imageReference) => {
  const imageId = getMongoImageId(imageReference);
  if (imageId) return deleteImageFromMongoDB(imageId);
  return null;
};

export default { uploadImageToMongoDB, deleteImageFromMongoDB, deleteMongoImageReference };
