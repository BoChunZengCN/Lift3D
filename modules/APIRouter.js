import { API_CONFIG } from '../config.js';

export class APIRouter {
  constructor(options = {}) {
    this.apis = {
      trellis: {
        ...API_CONFIG.trellis,
        key: options.trellisKey || API_CONFIG.trellis.key,
        cost: 0.08
      },
      tripo: {
        ...API_CONFIG.tripo,
        key: options.tripoKey || API_CONFIG.tripo.key,
        cost: 0.15
      }
    };

    this.primaryAPI = options.primaryAPI || 'trellis';
    this.fallbackAPI = options.fallbackAPI || 'tripo';
  }

  async generate(imageFile, options = {}) {
    const api = this.apis[this.primaryAPI];

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await this.callAPI(api, formData, options);

      if (response.success) {
        return {
          success: true,
          meshUrl: response.mesh_url,
          meshFormat: 'glb',
          taskId: response.task_id
        };
      } else {
        console.warn(`主API失败，尝试备用API: ${response.error}`);
        const fallbackResponse = await this.callAPI(
          this.apis[this.fallbackAPI],
          formData,
          options
        );
        return fallbackResponse;
      }
    } catch (error) {
      return {
        success: false,
        error: `生成失败: ${error.message}`
      };
    }
  }

  async callAPI(api, formData, options) {
    if (!api.key) {
      return {
        success: false,
        error: 'API密钥未配置，请在config.js中设置'
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), api.timeout);

      const response = await fetch(api.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.key}`
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.task_id) {
        return await this.pollTaskStatus(api, result.task_id);
      }

      if (result.output_url) {
        return {
          success: true,
          mesh_url: result.output_url
        };
      }

      return {
        success: false,
        error: result.error || '未知响应格式'
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: '请求超时' };
      }
      return { success: false, error: error.message };
    }
  }

  async pollTaskStatus(api, taskId) {
    const maxAttempts = 60;
    const interval = 10000;

    for (let i = 0; i < maxAttempts; i++) {
      await this.sleep(interval);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const statusResponse = await fetch(`${api.url}/task/${taskId}`, {
          headers: { 'Authorization': `Bearer ${api.key}` },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!statusResponse.ok) {
          continue;
        }

        const status = await statusResponse.json();

        if (status.status === 'completed') {
          return {
            success: true,
            mesh_url: status.output_url
          };
        } else if (status.status === 'failed') {
          return {
            success: false,
            error: status.error || '生成失败'
          };
        }
      } catch (error) {
        console.warn(`轮询失败: ${error.message}`);
      }
    }

    return {
      success: false,
      error: '生成超时'
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}