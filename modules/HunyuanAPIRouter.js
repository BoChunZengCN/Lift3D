export class HunyuanAPIRouter {
  constructor(options = {}) {
    this.secretId = options.secretId || '';
    this.secretKey = options.secretKey || '';
    this.host = 'hunyuan.tencentcloudapi.com';
    this.version = '2023-09-01';
    this.region = options.region || 'ap-guangzhou';
    this.progressCallback = null;
    this.useProxy = options.useProxy !== false;

    this.industrialConfig = {
      ModelVersion: options.modelVersion || 'HY-3D-3.1',
      TextureMode: options.textureMode || 'PBR',
      FaceCount: options.faceCount || 100000,
      EnableRigid: options.enableRigid !== false
    };
  }

  async generate(imageFile, options = {}) {
    try {
      const imageBase64 = await this.fileToBase64(imageFile);
      const params = {
        Image: imageBase64,
        ...this.industrialConfig,
        ...options
      };
      const submitResult = await this.submitTask(params);
      if (!submitResult.TaskId) {
        throw new Error('任务提交失败');
      }
      const result = await this.pollTaskStatus(submitResult.TaskId);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async submitTask(params) {
    const timestamp = Math.floor(Date.now() / 1000);
    const action = 'SubmitHunyuanTo3DJob';
    const response = await this.callTencentCloudAPI(action, params, timestamp);
    return response;
  }

  async pollTaskStatus(taskId) {
    const maxAttempts = 60;
    const interval = 5000;
    for (let i = 0; i < maxAttempts; i++) {
      await this.sleep(interval);
      const status = await this.queryTask(taskId);
      if (this.progressCallback) {
        this.progressCallback(Math.min(90, (i / maxAttempts) * 100));
      }
      if (status.Status === 'SUCCESS') {
        return {
          success: true,
          meshUrl: status.ModelUrl,
          textureUrl: status.TextureUrl,
          taskId: taskId
        };
      } else if (status.Status === 'FAILED') {
        return { success: false, error: status.ErrorMessage || '生成失败' };
      }
    }
    return { success: false, error: '生成超时' };
  }

  async queryTask(taskId) {
    const timestamp = Math.floor(Date.now() / 1000);
    const action = 'QueryHunyuanTo3DJob';
    const response = await this.callTencentCloudAPI(action, { TaskId: taskId }, timestamp);
    return response;
  }

  async callTencentCloudAPI(action, params, timestamp) {
    const body = JSON.stringify(params);
    const hashedRequestPayload = await this.sha256(body);
    const canonicalHeaders = `content-type:application/json\nhost:${this.host}\n`;
    const signedHeaders = 'content-type;host';
    const canonicalRequest = [
      'POST',
      '/',
      '',
      canonicalHeaders,
      signedHeaders,
      hashedRequestPayload
    ].join('\n');
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    const credentialScope = `${date}/hunyuan/tc3_request`;
    const hashedCanonicalRequest = await this.sha256(canonicalRequest);
    const stringToSign = [
      'TC3-HMAC-SHA256',
      timestamp.toString(),
      credentialScope,
      hashedCanonicalRequest
    ].join('\n');
    
    console.log('=== 签名调试信息 ===');
    console.log('SecretId:', this.secretId);
    console.log('SecretKey (前10位):', this.secretKey.substring(0, 10) + '...');
    console.log('Date:', date);
    console.log('Timestamp:', timestamp);
    console.log('Region:', this.region);
    console.log('Action:', action);
    console.log('CredentialScope:', credentialScope);
    console.log('CanonicalRequest:', canonicalRequest);
    console.log('StringToSign:', stringToSign);
    
    const kDate = await this.tc3HmacSha256(`TC3${this.secretKey}`, date);
    const kRegion = await this.tc3HmacSha256(kDate, this.region);
    const kService = await this.tc3HmacSha256(kRegion, 'hunyuan');
    const kSigning = await this.tc3HmacSha256(kService, 'tc3_request');
    const signature = await this.tc3HmacSha256(kSigning, stringToSign);
    
    console.log('kDate:', kDate);
    console.log('kRegion:', kRegion);
    console.log('kService:', kService);
    console.log('kSigning:', kSigning);
    console.log('Signature:', signature);
    
    const authorization = `TC3-HMAC-SHA256 Credential=${this.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    try {
      const url = this.useProxy ? `/api/hunyuan` : `https://${this.host}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorization,
          'X-TC-Action': action,
          'X-TC-Version': this.version,
          'X-TC-Region': this.region,
          'X-TC-Timestamp': timestamp.toString()
        },
        body: body,
        mode: 'cors'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      if (result.Response && result.Response.Error) {
        throw new Error(result.Response.Error.Message);
      }
      return result.Response || result;
    } catch (error) {
      console.error('API调用失败:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('网络请求失败，可能是CORS限制或API不可访问');
      }
      throw error;
    }
  }

  async tc3HmacSha256(key, data) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async sha256(data) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const INDUSTRIAL_PRESETS = {
  standard: {
    ModelVersion: 'HY-3D-3.1',
    TextureMode: 'PBR',
    FaceCount: 80000,
    EnableRigid: true
  },
  precision: {
    ModelVersion: 'HY-3D-3.1',
    TextureMode: 'PBR',
    FaceCount: 150000,
    EnableRigid: true
  },
  fast: {
    ModelVersion: 'HY-3D-3.0',
    TextureMode: 'Classic',
    FaceCount: 40000,
    EnableRigid: true
  },
  mechanical_standard: {
    ModelVersion: 'HY-3D-3.1',
    TextureMode: 'PBR',
    FaceCount: 80000,
    EnableRigid: true
  },
  mechanical_precision: {
    ModelVersion: 'HY-3D-3.1',
    TextureMode: 'PBR',
    FaceCount: 150000,
    EnableRigid: true
  },
  sheet_metal: {
    ModelVersion: 'HY-3D-3.1',
    TextureMode: 'Classic',
    FaceCount: 60000,
    EnableRigid: true
  },
  fastener: {
    ModelVersion: 'HY-3D-3.1',
    TextureMode: 'PBR',
    FaceCount: 50000,
    EnableRigid: true
  },
  preview: {
    ModelVersion: 'HY-3D-3.0',
    TextureMode: 'Classic',
    FaceCount: 40000,
    EnableRigid: true
  }
};