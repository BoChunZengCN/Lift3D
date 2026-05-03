import { ImageProcessor } from './modules/ImageProcessor.js';
import { HunyuanAPIRouter, INDUSTRIAL_PRESETS } from './modules/HunyuanAPIRouter.js';
import { MeshToStepConverter } from './modules/MeshToStepConverter.js';
import { ModelViewer } from './modules/ModelViewer.js';
import { StorageManager } from './modules/StorageManager.js';
import { API_CONFIG } from './config.js';

class Lift3DApp {
  constructor() {
    this.imageProcessor = new ImageProcessor();
    this.apiRouter = new HunyuanAPIRouter({
      secretId: API_CONFIG.hunyuan.secretId,
      secretKey: API_CONFIG.hunyuan.secretKey,
      region: API_CONFIG.hunyuan.region,
      modelVersion: API_CONFIG.hunyuan.modelVersion,
      textureMode: API_CONFIG.hunyuan.textureMode,
      faceCount: API_CONFIG.hunyuan.faceCount,
      enableRigid: API_CONFIG.hunyuan.enableRigid
    });
    this.converter = new MeshToStepConverter();
    this.storageManager = new StorageManager();
    this.viewer = null;

    this.state = {
      images: [],
      currentMesh: null,
      currentStep: null,
      isProcessing: false,
      currentTab: 'photo'
    };

    this.initClock();
    this.initCanvasBackground();
  }

  async init() {
    await this.storageManager.init();

    const container = document.getElementById('viewer-container');
    if (container) {
      this.viewer = new ModelViewer(container);
    }

    this.bindEvents();
    this.setupDragAndDrop();
    this.setupQualityListeners();
    await this.renderSpace();

    window.addEventListener('resize', () => {
      if (this.viewer) {
        this.viewer.onWindowResize();
      }
    });

    console.log('Lift3D应用初始化完成');
  }

  initClock() {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      const clockEl = document.getElementById('clock');
      if (clockEl) clockEl.textContent = timeStr;
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  initCanvasBackground() {
    const cv = document.getElementById('canvas-bg');
    if (!cv) return;
    
    const ctx = cv.getContext('2d');
    let W, H, T = 0;
    
    const layers = [
      { stars: [], count: 320, speed: 0.012, rMax: 1.1, aMax: 0.55 },
      { stars: [], count: 180, speed: 0.025, rMax: 1.6, aMax: 0.75 },
      { stars: [], count: 60, speed: 0.045, rMax: 2.2, aMax: 0.95 }
    ];
    
    const shoots = [];
    let nextShoot = 0;
    
    const starColors = ['255,255,255', '200,220,255', '255,240,200', '180,240,255', '220,200,255'];
    
    const resize = () => {
      W = cv.width = innerWidth;
      H = cv.height = innerHeight;
      layers.forEach(l => {
        l.stars = [];
        for (let i = 0; i < l.count; i++) l.stars.push(mkStar(l, true));
      });
    };
    
    const mkStar = (l, scatter) => {
      const band = scatter ? Math.random() : 0;
      const banded = Math.random() < 0.55;
      let x, y;
      if (banded) {
        const t = Math.random();
        const cx = W * (0.8 - t * 0.6);
        const cy = H * (0.1 + t * 0.8);
        x = cx + (Math.random() - 0.5) * W * 0.35;
        y = cy + (Math.random() - 0.5) * H * 0.18;
      } else {
        x = Math.random() * W;
        y = Math.random() * H;
      }
      return {
        x, y,
        r: Math.random() * l.rMax + 0.2,
        a: Math.random() * l.aMax + 0.05,
        base_a: Math.random() * l.aMax + 0.05,
        twinkle: Math.random() * Math.PI * 2,
        twinkle_speed: 0.3 + Math.random() * 0.8,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        banded
      };
    };
    
    const mkShoot = () => {
      const startX = Math.random() * W * 0.8 + W * 0.1;
      const startY = Math.random() * H * 0.4;
      const angle = Math.PI / 5 + Math.random() * Math.PI / 6;
      const len = 80 + Math.random() * 140;
      const speed = 5 + Math.random() * 7;
      return { x: startX, y: startY, angle, len, speed, life: 1, decay: 0.018 + Math.random() * 0.012 };
    };
    
    const drawNebula = () => {
      const nebulae = [
        { x: 0.72, y: 0.18, rx: 0.28, ry: 0.12, c: '40,60,160', a: 0.045 },
        { x: 0.55, y: 0.40, rx: 0.32, ry: 0.10, c: '80,20,120', a: 0.038 },
        { x: 0.38, y: 0.62, rx: 0.30, ry: 0.11, c: '10,80,140', a: 0.042 },
        { x: 0.22, y: 0.80, rx: 0.22, ry: 0.10, c: '60,30,100', a: 0.032 },
        { x: 0.80, y: 0.08, rx: 0.18, ry: 0.08, c: '20,100,160', a: 0.028 },
      ];
      nebulae.forEach(n => {
        const gx = n.x * W;
        const gy = n.y * H;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, n.rx * W);
        g.addColorStop(0, `rgba(${n.c}, ${n.a})`);
        g.addColorStop(0.5, `rgba(${n.c}, ${n.a * 0.4})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.scale(1, n.ry / n.rx);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(gx, gy * (n.rx / n.ry), n.rx * W, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };
    
    const drawMilkyWay = () => {
      const g = ctx.createLinearGradient(W * 0.9, 0, W * 0.1, H);
      g.addColorStop(0, 'rgba(60,80,180,0)');
      g.addColorStop(0.2, 'rgba(80,100,200,.04)');
      g.addColorStop(0.38, 'rgba(120,140,220,.07)');
      g.addColorStop(0.5, 'rgba(140,160,255,.09)');
      g.addColorStop(0.62, 'rgba(120,140,220,.07)');
      g.addColorStop(0.8, 'rgba(80,100,200,.04)');
      g.addColorStop(1, 'rgba(60,80,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      T += 0.008;
      
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.85);
      bg.addColorStop(0, 'rgba(6,10,30,1)');
      bg.addColorStop(0.4, 'rgba(3,7,20,1)');
      bg.addColorStop(1, 'rgba(1,3,10,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      
      drawMilkyWay();
      drawNebula();
      
      layers.forEach((l, li) => {
        l.stars.forEach(s => {
          const twinkle = Math.sin(T * s.twinkle_speed + s.twinkle) * 0.5 + 0.5;
          const a = s.base_a * (0.55 + twinkle * 0.45);
          
          if (s.r > 1.4) {
            const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
            halo.addColorStop(0, `rgba(${s.color}, ${a * 0.4})`);
            halo.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.color}, ${a})`;
          ctx.fill();
          
          s.x += l.speed * (li + 1) * 0.08;
          if (s.x > W + 4) {
            s.x = -4;
            s.y = Math.random() * H;
          }
        });
      });
      
      const now = performance.now();
      if (now > nextShoot) {
        shoots.push(mkShoot());
        nextShoot = now + 2200 + Math.random() * 5000;
      }
      
      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i];
        const ex = s.x + Math.cos(s.angle) * s.len * s.life;
        const ey = s.y + Math.sin(s.angle) * s.len * s.life;
        const g = ctx.createLinearGradient(s.x, s.y, ex, ey);
        g.addColorStop(0, `rgba(255,255,255,${s.life * 0.8})`);
        g.addColorStop(0.3, `rgba(200,230,255,${s.life * 0.5})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        
        s.life -= s.decay;
        if (s.life <= 0) shoots.splice(i, 1);
      }
      
      requestAnimationFrame(draw);
    };
    
    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  bindEvents() {
    document.getElementById('file-input')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        await this.handleImagesUpload(files);
      }
    });

    document.getElementById('btn-submit')?.addEventListener('click', async () => {
      await this.submitJob();
    });

    document.getElementById('btn-rotate')?.addEventListener('click', () => {
      if (this.viewer) {
        this.viewer.toggleAutoRotate();
      }
    });

    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      if (this.viewer) {
        this.viewer.zoomIn();
      }
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      if (this.viewer) {
        this.viewer.zoomOut();
      }
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (this.viewer) {
        this.viewer.resetView();
      }
    });

    // BP events
    document.getElementById('bp-file-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.handleCADUpload(file);
      }
    });
  }

  setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
      dropZone.classList.add('drag-over');
    }

    function unhighlight() {
      dropZone.classList.remove('drag-over');
    }

    dropZone.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));
      
      if (files.length > 0) {
        await this.handleImagesUpload(files);
      } else {
        this.showError('请上传有效的图片文件');
      }
    });
  }

  setupQualityListeners() {
    const qualityRadios = document.querySelectorAll('input[name="quality"]');
    const durationDisplay = document.getElementById('rd-dur');
    const featDisplay = document.getElementById('rd-feat');
    
    const configMap = {
      low: { dur: '3 – 8 分钟', feat: '4096' },
      medium: { dur: '5 – 15 分钟', feat: '8192' },
      high: { dur: '10 – 25 分钟', feat: '16384' }
    };

    qualityRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const config = configMap[e.target.value] || configMap.medium;
        durationDisplay.textContent = config.dur;
        featDisplay.textContent = config.feat;
      });
    });
  }

  async handleImagesUpload(files) {
    this.showStatus('处理图片...');
    
    for (const file of files) {
      if (this.state.images.length >= 200) {
        this.showError('已达到最大图片数量限制 (200张)');
        break;
      }
      
      const result = await this.imageProcessor.process(file);
      
      if (result.success) {
        const existingIndex = this.state.images.findIndex(img => img.name === file.name);
        if (existingIndex === -1) {
          this.state.images.push({
            ...result.data,
            name: file.name,
            file: file
          });
        }
      }
    }
    
    this.updateThumbGrid();
    this.updateSubmitButton();
    this.showSuccess(`已添加 ${files.length} 张图片`);
  }

  updateThumbGrid() {
    const gridSection = document.getElementById('grid-section');
    const grid = document.getElementById('thumb-grid');
    const gridCount = document.getElementById('grid-count');
    
    if (this.state.images.length === 0) {
      gridSection.style.display = 'none';
      return;
    }
    
    gridSection.style.display = 'block';
    gridCount.textContent = `${this.state.images.length} / 200 张图片`;
    
    grid.innerHTML = this.state.images.map((img, index) => `
      <div class="thumb-wrap" style="animation-delay: ${index * 0.03}s">
        <img src="${img.thumbnail}" alt="${img.name}">
        <div class="thumb-ov"></div>
        <button class="thumb-del" onclick="app.removeImage(${index})">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <span class="thumb-ql ${img.quality === 'good' ? 'ok' : 'warn'}">${index + 1}</span>
      </div>
    `).join('');
  }

  removeImage(index) {
    this.state.images.splice(index, 1);
    this.updateThumbGrid();
    this.updateSubmitButton();
  }

  updateSubmitButton() {
    const submitBtn = document.getElementById('btn-submit');
    const smFrames = document.getElementById('sm-frames');
    
    smFrames.textContent = `${this.state.images.length} / 至少10张`;
    
    if (this.state.images.length >= 10) {
      submitBtn.disabled = false;
      document.getElementById('sm-status').textContent = '就绪';
    } else {
      submitBtn.disabled = true;
      document.getElementById('sm-status').textContent = `还需 ${10 - this.state.images.length} 张图片`;
    }
  }

  async submitJob() {
    if (this.state.images.length < 10 || this.state.isProcessing) return;
    
    this.state.isProcessing = true;
    this.showProgress(true);
    this.updateProgress(0, '初始化...');
    this.setStageStatus('validating', 'active');
    
    const jobId = this.generateJobId();
    document.getElementById('job-id-label').textContent = `JOB-ID: ${jobId}`;
    
    try {
      const quality = localStorage.getItem('lift3d_quality') || 'standard';
      const preset = INDUSTRIAL_PRESETS[quality] || INDUSTRIAL_PRESETS.mechanical_standard;
      
      this.updateProgress(10, '图像预处理...');
      this.setStageStatus('validating', 'done');
      
      const mainImage = this.state.images[0].file;
      
      this.setStageStatus('sfm', 'active');
      this.updateProgress(20, '调用混元3D API...');
      
      if (!API_CONFIG.hunyuan.secretId || !API_CONFIG.hunyuan.secretKey) {
        throw new Error('请在 config.js 中配置腾讯云 SecretId 和 SecretKey');
      }
      
      this.apiRouter.setProgressCallback((progress) => {
        const mappedProgress = 20 + Math.floor(progress * 0.5);
        this.updateProgress(mappedProgress, '模型生成中...');
      });
      
      const result = await this.apiRouter.generate(mainImage, preset);
      
      this.setStageStatus('sfm', 'done');
      this.setStageStatus('mvs', 'done');
      this.setStageStatus('postprocessing', 'active');
      
      this.updateProgress(80, '下载模型...');
      
      if (!result.success) {
        throw new Error(result.error || '生成失败');
      }
      
      this.updateProgress(90, '加载模型...');
      await this.loadModelFromUrl(result.meshUrl);
      
      this.setStageStatus('postprocessing', 'done');
      this.updateProgress(100, '完成！');
      
      await this.delay(500);
      this.showSuccess('重建完成！');
      
    } catch (error) {
      this.showError(`重建失败: ${error.message}`);
    } finally {
      this.state.isProcessing = false;
    }
  }

  async handleCADUpload(file) {
    const preview = document.getElementById('bp-preview');
    const previewEmpty = document.getElementById('bp-preview-empty');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <img src="${e.target.result}" alt="${file.name}">
        <div class="bp-preview-name">${file.name}</div>
      `;
      
      document.getElementById('btn-bp-submit').disabled = false;
      document.getElementById('bp-status').textContent = '就绪';
      document.getElementById('bp-fname').textContent = file.name;
    };
    
    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      previewEmpty.textContent = `${file.name} - 非图片格式，无法预览`;
      document.getElementById('btn-bp-submit').disabled = false;
      document.getElementById('bp-status').textContent = '就绪';
      document.getElementById('bp-fname').textContent = file.name;
    }
  }

  async submitBp() {
    const jobId = this.generateJobId();
    document.getElementById('bp-job-label').textContent = `JOB-ID: ${jobId}`;
    
    const progPanel = document.getElementById('bp-prog-panel');
    progPanel.classList.add('show');
    
    this.updateBpProgress(0, '初始化...');
    this.setBpStageStatus('ocr', 'active');
    
    await this.delay(500);
    this.updateBpProgress(25, 'OCR 线稿提取...');
    
    await this.delay(800);
    this.setBpStageStatus('ocr', 'done');
    this.setBpStageStatus('semantic', 'active');
    this.updateBpProgress(40, 'AI 语义理解...');
    
    await this.delay(1000);
    this.updateBpProgress(60, '解析工程图...');
    
    await this.delay(800);
    this.setBpStageStatus('semantic', 'done');
    this.setBpStageStatus('model', 'active');
    this.updateBpProgress(70, '三维推拉建模...');
    
    await this.delay(1000);
    this.updateBpProgress(85, '生成网格...');
    
    await this.delay(600);
    this.setBpStageStatus('model', 'done');
    this.setBpStageStatus('export', 'active');
    this.updateBpProgress(95, '格式导出...');
    
    await this.delay(400);
    this.setBpStageStatus('export', 'done');
    this.updateBpProgress(100, '完成！');
    
    await this.delay(500);
    
    progPanel.classList.remove('show');
    document.getElementById('bp-result-panel').style.display = 'block';
    
    document.getElementById('bp-result-files').innerHTML = `
      <div class="result-file">
        <div class="file-left">
          <span class="file-fmt">GLB</span>
          <span class="file-name">model.glb</span>
        </div>
        <div class="file-right">
          <span class="file-sz">~1.8 MB</span>
          <button class="btn-dl">下载</button>
        </div>
      </div>
    `;
  }

  generateJobId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showProgress(show) {
    const panel = document.getElementById('prog-panel');
    const submitBtn = document.getElementById('btn-submit');
    
    if (panel) {
      panel.style.display = show ? 'block' : 'none';
    }
    
    if (submitBtn) {
      submitBtn.disabled = show;
    }
  }

  updateProgress(percent, message) {
    const pctNum = document.getElementById('pct-num');
    const progFill = document.getElementById('prog-fill');
    const progMsg = document.getElementById('prog-msg');
    
    if (pctNum) pctNum.textContent = percent;
    if (progFill) progFill.style.width = `${percent}%`;
    if (progMsg) progMsg.textContent = message;
  }

  updateBpProgress(percent, message) {
    const pctNum = document.getElementById('bp-pct');
    const progFill = document.getElementById('bp-fill');
    const progMsg = document.getElementById('bp-msg');
    
    if (pctNum) pctNum.textContent = percent;
    if (progFill) progFill.style.width = `${percent}%`;
    if (progMsg) progMsg.textContent = message;
  }

  setStageStatus(stageId, status) {
    const stage = document.querySelector(`[data-stage="${stageId}"]`);
    if (stage) {
      stage.classList.remove('active', 'done');
      stage.classList.add(status);
      const val = stage.querySelector('.stage-val');
      if (val) {
        val.textContent = status === 'done' ? '完成' : status === 'active' ? '进行中' : '--';
      }
    }
  }

  setBpStageStatus(stageId, status) {
    const stage = document.querySelector(`[data-bpstage="${stageId}"]`);
    if (stage) {
      stage.classList.remove('active', 'done');
      stage.classList.add(status);
      const val = stage.querySelector('.bp-stage-val');
      if (val) {
        val.textContent = status === 'done' ? '完成' : status === 'active' ? '进行中' : '--';
      }
    }
  }

  async loadModelFromUrl(url) {
    if (this.viewer) {
      try {
        await this.viewer.loadModel(url);
        const resultPanel = document.getElementById('result-panel');
        const filesContainer = document.getElementById('result-files');
        
        filesContainer.innerHTML = `
          <div class="result-file">
            <div class="file-left">
              <span class="file-fmt">GLB</span>
              <span class="file-name">model.glb</span>
            </div>
            <div class="file-right">
              <a href="${url}" download="model.glb" class="btn-dl">下载</a>
            </div>
          </div>
        `;
        
        resultPanel.style.display = 'block';
        this.state.currentMesh = url;
      } catch (error) {
        console.error('模型加载失败:', error);
        throw new Error('模型加载失败');
      }
    }
  }

  async showPhotoResult() {
    const resultPanel = document.getElementById('result-panel');
    const filesContainer = document.getElementById('result-files');
    
    const checkedFormats = [];
    if (document.getElementById('fmt-glb')?.checked) checkedFormats.push('GLB');
    if (document.getElementById('fmt-obj')?.checked) checkedFormats.push('OBJ');
    if (document.getElementById('fmt-stl')?.checked) checkedFormats.push('STL');
    
    filesContainer.innerHTML = checkedFormats.map(fmt => `
      <div class="result-file">
        <div class="file-left">
          <span class="file-fmt">${fmt}</span>
          <span class="file-name">model.${fmt.toLowerCase()}</span>
        </div>
        <div class="file-right">
          <span class="file-sz">~${(Math.random() * 3 + 1).toFixed(1)} MB</span>
          <button class="btn-dl">下载</button>
        </div>
      </div>
    `).join('');
    
    resultPanel.style.display = 'block';
    document.getElementById('result-expire').textContent = '结果保留 24 小时';
  }

  showStatus(message) {
    const el = document.getElementById('sm-status');
    if (el) el.textContent = message;
  }

  showError(message) {
    const errBar = document.getElementById('err-bar');
    errBar.textContent = message;
    errBar.classList.add('show');
    errBar.style.borderColor = 'var(--red)';
    errBar.style.color = 'var(--red)';
    errBar.style.background = 'rgba(255, 61, 90, .07)';
    
    setTimeout(() => {
      errBar.classList.remove('show');
    }, 5000);
  }

  showSuccess(message) {
    const errBar = document.getElementById('err-bar');
    errBar.textContent = message;
    errBar.classList.remove('show');
    errBar.style.borderColor = 'var(--green)';
    errBar.style.color = 'var(--green)';
    errBar.style.background = 'rgba(0, 255, 157, .07)';
    
    setTimeout(() => {
      errBar.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      errBar.classList.remove('show');
    }, 5000);
  }

  async renderSpace() {
    const grid = document.getElementById('model-grid');
    const empty = document.getElementById('space-empty');
    const stats = document.getElementById('space-stats');
    const search = document.getElementById('space-search')?.value || '';
    const sortBy = document.getElementById('space-sort')?.value || 'date';
    const statCount = document.getElementById('stat-count');
    
    if (!grid || !empty || !stats) return;
    
    try {
      let models = await this.storageManager.getAllModels();
      
      if (search) {
        models = models.filter(m => {
          const name = `模型 ${m.id}`;
          return name.toLowerCase().includes(search.toLowerCase());
        });
      }
      
      if (sortBy === 'date') {
        models = models.reverse();
      } else if (sortBy === 'name') {
        models = models.sort((a, b) => a.id - b.id);
      }
      
      if (statCount) {
        statCount.textContent = models.length;
      }
      
      if (models.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        stats.style.display = 'none';
        return;
      }
      
      grid.style.display = 'grid';
      empty.style.display = 'none';
      stats.style.display = 'flex';
      
      grid.innerHTML = models.map((model, index) => `
        <div class="model-card" style="animation-delay: ${index * 0.05}s" onclick="openDrawer(${model.id})">
          <div class="model-thumb">
            <img src="${model.image}" alt="模型缩略图" onerror="this.style.display='none'; this.parentElement.querySelector('.model-thumb-icon')?.style.display='flex';">
            <div class="model-thumb-icon" style="display:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polyline points="21 15 18 9 3 18"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <span class="model-source-badge ${model.source === 'cad' ? 'badge-cad' : 'badge-photo'}">
              ${model.source === 'cad' ? '图纸' : '照片'}
            </span>
            <div class="model-actions">
              <button class="model-action-btn" onclick="event.stopPropagation()">
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>
              </button>
              <button class="model-action-btn del" onclick="event.stopPropagation(); deleteModel(${model.id})">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="model-info">
            <div class="model-name">模型 ${model.id}</div>
            <div class="model-meta">
              <span>${new Date(model.createdAt).toLocaleDateString('zh-CN')}</span>
              <div class="model-fmts">
                <span class="model-fmt-tag">GLB</span>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('加载空间失败:', error);
    }
  }

  async saveToCabinet(source) {
    try {
      await this.storageManager.saveModel({
        image: this.state.images[0]?.thumbnail || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' ,
        timestamp: new Date().toISOString(),
        source: source
      });
      await this.renderSpace();
      this.showSuccess('已保存到个人空间');
    } catch (error) {
      this.showError('保存失败');
    }
  }
}

function switchTab(tabId) {
  const tabs = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');
  
  tabs.forEach(tab => {
    const isActive = tab.getAttribute('onclick')?.includes(tabId);
    tab.classList.toggle('active', isActive);
  });
  
  panels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });
  
  app.state.currentTab = tabId;
  
  if (tabId === 'space') {
    app.renderSpace();
  }
}

function clearAll() {
  app.state.images = [];
  document.getElementById('file-input').value = '';
  document.getElementById('grid-section').style.display = 'none';
  document.getElementById('btn-submit').disabled = true;
  document.getElementById('sm-status').textContent = '等待输入';
  document.getElementById('sm-frames').textContent = '0 / 至少10张';
  
  const resultPanel = document.getElementById('result-panel');
  if (resultPanel) resultPanel.style.display = 'none';
  
  const progPanel = document.getElementById('prog-panel');
  if (progPanel) progPanel.style.display = 'none';
}

function resetAll() {
  clearAll();
}

function resetBp() {
  document.getElementById('bp-file-input').value = '';
  document.getElementById('bp-preview').innerHTML = `
    <div class="bp-preview-empty" id="bp-preview-empty">
      <div style="margin-bottom:8px;font-size:22px;opacity:.3">⬡</div>
      上传后在此预览
    </div>
  `;
  document.getElementById('btn-bp-submit').disabled = true;
  document.getElementById('bp-status').textContent = '等待上传图纸';
  document.getElementById('bp-fname').textContent = '—';
  document.getElementById('bp-prog-panel').classList.remove('show');
  document.getElementById('bp-result-panel').style.display = 'none';
}

function updateBpReadout() {
  const depth = document.getElementById('bp-depth').value;
  const durDisplay = document.getElementById('bpr-dur');
  
  const durMap = {
    shell: '20 – 45 秒',
    solid: '30 – 90 秒',
    detail: '60 – 120 秒'
  };
  
  durDisplay.textContent = durMap[depth] || '30 – 90 秒';
}

function filterSpace(filter) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  app.renderSpace();
}

function renderSpace() {
  app.renderSpace();
}

function openDrawer(modelId) {
  const overlay = document.getElementById('drawer-overlay');
  const body = document.getElementById('drawer-body');
  
  body.innerHTML = `
    <div class="drawer-thumb">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=".8">
        <polyline points="21 15 18 9 3 18"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </div>
    <div class="drawer-row"><span class="drawer-key">模型ID</span><span class="drawer-val">模型 ${modelId}</span></div>
    <div class="drawer-row"><span class="drawer-key">创建时间</span><span class="drawer-val">${new Date().toLocaleString('zh-CN')}</span></div>
    <div class="drawer-row"><span class="drawer-key">来源</span><span class="drawer-val">照片重建</span></div>
    <div class="drawer-row"><span class="drawer-key">格式</span><span class="drawer-val">GLB</span></div>
    <div class="drawer-files">
      <div class="drawer-file">
        <span class="file-fmt" style="font-size:10px">GLB</span>
        <button class="btn-dl" style="font-size:11px">下载</button>
      </div>
    </div>
    <div class="drawer-actions">
      <button class="btn-full">查看详情</button>
      <button class="btn-full danger" onclick="deleteModel(${modelId}); closeDrawer()">删除模型</button>
    </div>
  `;
  
  overlay.classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
}

async function deleteModel(modelId) {
  try {
    await app.storageManager.deleteModel(modelId);
    await app.renderSpace();
    closeDrawer();
  } catch (error) {
    console.error('删除失败:', error);
  }
}

function saveToCabinet(source) {
  app.saveToCabinet(source);
}

const app = new Lift3DApp();
app.init();

window.app = app;
window.switchTab = switchTab;
window.resetAll = resetAll;
window.resetBp = resetBp;
window.updateBpReadout = updateBpReadout;
window.filterSpace = filterSpace;
window.renderSpace = renderSpace;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.deleteModel = deleteModel;
window.saveToCabinet = saveToCabinet;
window.submitBp = () => app.submitBp();
window.submitJob = () => app.submitJob();