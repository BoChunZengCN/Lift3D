# Lift3D - 工业零件三维重建系统

基于腾讯混元3D（Hunyuan 3D）的工业零件三维重建系统，支持多视角照片重建和图纸自动建模。

## 功能特性

### 核心功能
- **多视角照片重建**：上传10张以上工业零件照片，自动生成三维模型
- **图纸自动建模**：支持DWG、DXF、PDF、PNG、SVG等格式图纸上传
- **模型预览与导出**：支持GLB、OBJ、STL格式导出
- **模型历史管理**：本地存储重建记录

### 技术栈
- **前端框架**：原生JavaScript + Vite
- **3D渲染**：Three.js
- **API集成**：腾讯混元3D API
- **存储**：IndexedDB本地存储

## 快速开始

### 环境要求
- Node.js >= 16
- 现代浏览器（Chrome、Firefox、Edge等）

### 安装依赖

```bash
npm install
```

### 配置API密钥

1. 复制环境变量示例文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入您的腾讯云密钥：
```
VITE_TENCENT_SECRET_ID=您的SecretId
VITE_TENCENT_SECRET_KEY=您的SecretKey
```

### 获取腾讯云密钥

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 开通 **混元3D** 服务：https://console.cloud.tencent.com/ai3d
3. 获取密钥：https://console.cloud.tencent.com/cam/capi
4. 领取免费额度（200积分 ≈ 50次生成）

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000/

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 使用指南

### 多视角照片重建

1. 切换到"多视角照片重建"标签
2. 上传至少10张工业零件照片（建议15-30张）
3. 选择质量预设：
   - **标准**：适用于一般零件，平衡质量与速度
   - **精密**：适用于复杂零件，高面数精细建模
   - **快速**：适用于简单零件，快速预览
4. 点击"提交重建"按钮
5. 等待模型生成（通常1-3分钟）
6. 生成完成后可在3D查看器中预览模型
7. 下载模型文件（GLB格式）

### 图纸自动建模

1. 切换到"图纸自动建模"标签
2. 上传工程图纸（DWG、DXF、PDF、PNG、SVG）
3. 设置建模参数
4. 点击"提交建模"
5. 查看建模结果

## 项目结构

```
Lift3D/
├── index.html          # 主页面
├── main.js             # 应用入口
├── config.js           # API配置
├── vite.config.js      # Vite配置
├── package.json        # 项目依赖
├── styles/
│   └── main.css        # 样式文件
├── modules/
│   ├── HunyuanAPIRouter.js    # 腾讯混元3D API路由
│   ├── ImageProcessor.js      # 图像处理
│   ├── ModelViewer.js         # 3D模型查看器
│   ├── MeshToStepConverter.js # 网格转STEP格式
│   └── StorageManager.js      # 本地存储管理
└── dist/               # 构建产物
```

## API配置说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| region | API区域 | ap-guangzhou |
| modelVersion | 模型版本 | HY-3D-3.1 |
| textureMode | 纹理模式 | PBR |
| faceCount | 模型面数 | 100000 |
| enableRigid | 启用刚性约束 | true |

## 常见问题

### 1. API调用失败，签名错误
- 检查 `VITE_TENCENT_SECRET_ID` 和 `VITE_TENCENT_SECRET_KEY` 是否正确
- 确保腾讯云账号已开通混元3D服务
- 检查密钥是否有API调用权限

### 2. 模型生成失败
- 确保上传的图片数量 >= 10张
- 图片需要包含足够的特征点
- 尝试不同的质量预设

### 3. 3D模型无法预览
- 确保浏览器支持WebGL
- 尝试使用Chrome或Firefox最新版本

## 开发说明

### 添加新的API提供者

1. 在 `modules/` 目录创建新的API路由模块
2. 在 `config.js` 中添加配置
3. 在 `main.js` 中集成新模块

### 修改样式

编辑 `styles/main.css` 文件，遵循CSS变量约定：
- 背景色：`--bg`
- 主色调：`--cyan`
- 文字色：`--text`

## 许可证

MIT License

## 致谢

- [Three.js](https://threejs.org/) - 3D渲染引擎
- [腾讯混元3D](https://cloud.tencent.com/product/hunyuan-3d) - 3D生成API
