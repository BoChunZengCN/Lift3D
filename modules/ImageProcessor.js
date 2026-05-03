import { APP_CONFIG } from '../config.js';

export class ImageProcessor {
  constructor(options = {}) {
    this.maxFileSize = options.maxFileSize || APP_CONFIG.maxFileSize;
    this.allowedTypes = options.allowedTypes || APP_CONFIG.allowedImageTypes;
    this.minDimension = options.minDimension || APP_CONFIG.minImageDimension;
  }

  async process(file) {
    if (!this.allowedTypes.includes(file.type)) {
      return { success: false, error: '不支持的图片格式，请上传 JPG/PNG/WebP' };
    }

    if (file.size > this.maxFileSize) {
      return { success: false, error: '文件过大，请上传小于10MB的图片' };
    }

    try {
      const imageData = await this.loadImage(file);

      if (imageData.width < this.minDimension || imageData.height < this.minDimension) {
        return {
          success: false,
          error: `图片尺寸过小，建议至少${this.minDimension}px`
        };
      }

      const thumbnail = await this.generateThumbnail(imageData, APP_CONFIG.thumbnailSize, APP_CONFIG.thumbnailSize);

      return {
        success: true,
        data: {
          file: file,
          width: imageData.width,
          height: imageData.height,
          thumbnail: thumbnail,
          aspectRatio: imageData.width / imageData.height
        }
      };
    } catch (error) {
      return { success: false, error: `图片处理失败: ${error.message}` };
    }
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve({
          element: img,
          width: img.width,
          height: img.height
        });
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  generateThumbnail(imageData, maxWidth, maxHeight) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scale = Math.min(maxWidth / imageData.width, maxHeight / imageData.height);
      canvas.width = imageData.width * scale;
      canvas.height = imageData.height * scale;

      ctx.drawImage(imageData.element, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    });
  }
}