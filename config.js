export const API_CONFIG = {
  hunyuan: {
    secretId: 'AKID22rX1RfkfOgolV3NWVJwTt8E9uVKxNdk',
    secretKey: 'ymbQAlDVdaLvMi5OXaS8g4GH8pLgqpeK',
    region: 'ap-guangzhou',
    modelVersion: 'HY-3D-3.1',
    textureMode: 'PBR',
    faceCount: 100000,
    enableRigid: true,
    timeout: 180000
  },
  trellis: {
    url: 'https://api.piapi.ai/v1/trellis',
    key: '',
    timeout: 120000
  },
  tripo: {
    url: 'https://api.tripo3d.ai/v2/generate',
    key: '',
    timeout: 120000
  },
  wavespeed: {
    url: 'https://api.wavespeed.ai/v1/hunyuan-3d',
    key: '',
    timeout: 120000
  }
};

export const APP_CONFIG = {
  maxFileSize: 10 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minImageDimension: 512,
  thumbnailSize: 200
};

export const STORAGE_CONFIG = {
  dbName: 'Lift3D_DB',
  dbVersion: 1
};