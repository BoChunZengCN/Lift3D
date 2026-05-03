export const API_CONFIG = {
  hunyuan: {
    secretId: 'YOUR_SECRET_ID_HERE',
    secretKey: 'YOUR_SECRET_KEY_HERE',
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
