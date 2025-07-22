# YTLantern

一个高性能的YouTube视频解析和代理服务，在主机上解析YouTube视频。采用现代化技术栈构建，提供流畅稳定的系统。

## 核心功能

- **视频解析**: 支持多种YouTube链接格式，自动解析视频直链
- **质量选择**: 提供144p到1080p多种清晰度选项
- **智能缓存**: Redis缓存机制，提升访问速度
- **历史记录**: 本地存储观看历史，支持搜索管理
- **响应式界面**: 适配桌面和移动设备
- **主题切换**: 支持浅色和深色模式
- **下载功能**: 支持视频下载和直链获取

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用户浏览器     │    │   Nginx代理     │    │   前端服务       │
│                 │    │                 │    │   (Next.js)     │
│  - 视频播放      │◄──►│  - 反向代理     │◄──►│  - React组件     │
│  - 界面交互      │    │  - 静态文件     │    │  - 状态管理      │
│  - 历史记录      │    │  - 负载均衡     │    │  - API调用       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Redis缓存     │    │   后端API        │    │   yt-dlp解析    │
│                 │    │  (FastAPI)      │    │                 │
│  - 视频信息     │◄──► │  - 视频解析      │◄──►│  - YouTube API │
│  - 用户会话     │     │  - 缓存管理      │    │  - 格式提取     │
│  - 限流计数     │     │  - 限流控制      │    │  - 质量选择     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 技术栈

**前端技术**
- Next.js 14 (React框架)
- TypeScript (类型安全)
- Tailwind CSS (样式框架)
- shadcn/ui (组件库)
- Zustand (状态管理)

**后端技术**
- Python 3.11
- FastAPI (Web框架)
- yt-dlp (视频解析)
- Redis (缓存数据库)
- Pydantic (数据验证)

**部署技术**
- Docker & Docker Compose
- Nginx (反向代理)
- Let's Encrypt (SSL证书)

## 实现原理

### 视频解析流程

1. **链接验证**: 前端验证YouTube链接格式
2. **API请求**: 发送解析请求到后端API
3. **缓存检查**: 检查Redis中是否有缓存的视频信息
4. **yt-dlp解析**: 使用yt-dlp提取视频元数据和直链
5. **格式选择**: 根据用户选择的质量筛选最佳格式
6. **结果缓存**: 将解析结果存储到Redis缓存
7. **返回数据**: 返回视频信息给前端展示

### 缓存策略

- **视频信息缓存**: 1小时有效期，减少重复解析
- **限流计数缓存**: 按分钟和小时统计请求次数
- **会话缓存**: 存储用户临时数据

### 安全机制

- **请求限流**: 每分钟10次，每小时100次请求限制
- **CORS保护**: 限制跨域访问来源
- **输入验证**: 严格验证所有用户输入
- **错误处理**: 统一的错误处理和日志记录

## 系统要求

**最低配置**
- 操作系统: Ubuntu 18.04+ 或 Debian 10+
- 内存: 2GB RAM
- 存储: 20GB 可用空间
- 网络: 能访问YouTube的VPS
- CPU: 1核心

**推荐配置**
- 内存: 4GB+ RAM
- 存储: 50GB+ SSD
- 网络: 100Mbps+ 带宽
- CPU: 2核心+

## 快速部署

### 一键部署

```bash
# 克隆项目
git clone https://github.com/DudeGuuud/ytlantern.git
cd ytlantern

# 基础部署
chmod +x deploy.sh
./deploy.sh

# 带域名和SSL
./deploy.sh --domain yourdomain.com --email your@email.com --ssl
```

### 使用Makefile

```bash
# 快速启动
make quick-start

# 分步执行
make install    # 安装依赖
make build      # 构建应用
make start      # 启动服务
```

## 详细部署教程

### 1. 环境准备

**更新系统**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip
```

**安装Docker**
```bash
# 安装Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 重新登录应用组权限
newgrp docker
```

**安装Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. 项目配置

**克隆代码**
```bash
git clone https://github.com/DudeGuuud/ytlantern.git
cd ytlantern
```

**配置环境变量**
```bash
# 后端配置
cp backend/.env.example backend/.env
nano backend/.env
```

**后端配置说明**
```env
# 服务器设置
HOST=0.0.0.0
PORT=8000
DEBUG=false
WORKERS=4

# Redis缓存
REDIS_URL=redis://redis:6379/0

# 视频存储
VIDEO_STORAGE_PATH=/app/videos
MAX_VIDEO_SIZE_MB=500
CLEANUP_INTERVAL_HOURS=24

# 访问限制
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=100

# 跨域设置
CORS_ORIGINS=["http://localhost", "https://yourdomain.com"]
```

**前端配置**
```bash
cp .env.example .env.local
nano .env.local
```

```env
NEXT_PUBLIC_API_URL=http://yourdomain.com/api/v1
NODE_ENV=production
```

### 3. 构建部署

**安装依赖**
```bash
npm install
```

**构建前端**
```bash
npm run build
```

**启动服务**
```bash
# 构建Docker镜像
docker-compose build

# 启动所有服务
docker-compose up -d

# 检查服务状态
docker-compose ps
```

### 4. 域名和SSL配置

**配置域名解析**
1. 将域名A记录指向服务器IP
2. 等待DNS传播（5-30分钟）

**配置SSL证书**
```bash
# 自动配置SSL
./deploy.sh --domain yourdomain.com --email your@email.com --ssl

# 手动配置SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

**更新Nginx配置**
编辑 `nginx/nginx.conf`，启用SSL配置块。

### 5. 防火墙配置

```bash
# 配置UFW防火墙
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 使用说明

### 基本使用

1. 打开浏览器访问 `http://your-server-ip` 或 `https://yourdomain.com`
2. 在输入框粘贴YouTube视频链接
3. 选择视频质量（推荐720p）
4. 点击"解析视频"按钮
5. 等待解析完成后观看视频

### 支持的链接格式

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`
- `https://youtube.com/embed/VIDEO_ID`

### 质量选择建议

| 质量 | 分辨率 | 适用场景 | 流量消耗 |
|------|--------|----------|----------|
| 144p | 256×144 | 网络极慢 | 极低 |
| 240p | 426×240 | 移动网络 | 低 |
| 360p | 640×360 | 标清观看 | 中等 |
| 480p | 854×480 | 高清观看 | 中高 |
| 720p | 1280×720 | 推荐选择 | 高 |
| 1080p | 1920×1080 | 最佳画质 | 很高 |

### 功能特性

- **视频播放**: 自定义播放器，支持全屏和音量控制
- **下载功能**: 点击下载按钮保存视频到本地
- **历史记录**: 自动保存观看历史，支持搜索和管理
- **直链获取**: 复制视频直链在其他播放器使用
- **主题切换**: 支持浅色和深色模式

## 运维管理

### 服务管理

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新服务
docker-compose pull && docker-compose up -d
```

### 备份和恢复

```bash
# 创建备份
./scripts/backup.sh

# 恢复备份
./scripts/restore.sh backups/ytlantern-backup-YYYYMMDD-HHMMSS.tar.gz

# 查看备份列表
ls -la backups/
```

### 监控和维护

```bash
# 运行健康检查
./scripts/monitor.sh

# 生成状态报告
./scripts/monitor.sh --report

# 启动守护进程监控
./scripts/monitor.sh --daemon --email admin@example.com
```

### 应用更新

```bash
# 自动更新
./scripts/update.sh

# 手动更新
git pull
docker-compose build --no-cache
docker-compose up -d
```

## 故障排除

### 常见问题

**1. 端口被占用**
```bash
# 检查端口占用
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# 停止占用端口的服务
sudo systemctl stop apache2
sudo systemctl stop nginx
```

**2. Docker权限问题**
```bash
# 添加用户到docker组
sudo usermod -aG docker $USER
newgrp docker
```

**3. 视频解析失败**
- 检查网络连接和YouTube可访问性
- 更新yt-dlp: `docker-compose exec backend pip install --upgrade yt-dlp`
- 尝试不同的视频质量选项

**4. 内存不足**
```bash
# 检查内存使用
free -h
docker stats

# 重启服务释放内存
docker-compose restart
```

**5. 磁盘空间不足**
```bash
# 检查磁盘使用
df -h

# 清理Docker
docker system prune -f
docker volume prune -f

# 清理旧视频文件
./scripts/monitor.sh
```

### 性能优化

**增加内存**
- 推荐至少4GB RAM
- 配置swap文件

**优化Docker**
```yaml
# 在docker-compose.yml中限制内存使用
services:
  backend:
    mem_limit: 1g
    memswap_limit: 1g
```

**优化Nginx**
```nginx
# 调整worker进程数
worker_processes auto;
worker_connections 1024;
```

## 项目结构

```
YTLantern/
├── 📄 README.md                 # 项目说明文档
├── 📄 LICENSE                   # 开源许可证
├── 📄 Makefile                  # 便捷命令集合
├── 🚀 deploy.sh                # 一键部署脚本
├── 🐳 docker-compose.yml       # Docker服务编排
├── 🐳 Dockerfile.frontend      # 前端Docker镜像
├── ⚙️ next.config.js           # Next.js配置
├── ⚙️ tailwind.config.js       # Tailwind CSS配置
├── ⚙️ tsconfig.json            # TypeScript配置
├── 📦 package.json             # Node.js依赖配置
├── 📂 src/                     # 前端源代码
│   ├── 📂 app/                 # Next.js App Router
│   ├── 📂 components/          # React组件
│   │   ├── 📂 ui/              # 基础UI组件
│   │   ├── 📂 layout/          # 布局组件
│   │   ├── 📂 video/           # 视频相关组件
│   │   └── 📂 history/         # 历史记录组件
│   ├── 📂 hooks/               # 自定义Hooks
│   ├── 📂 lib/                 # 工具库
│   ├── 📂 store/               # 状态管理
│   └── 📂 types/               # TypeScript类型
├── 📂 backend/                 # 后端源代码
│   ├── 📄 Dockerfile           # 后端Docker镜像
│   ├── 📄 requirements.txt     # Python依赖
│   └── 📂 app/                 # Python应用代码
│       ├── 📄 main.py          # FastAPI应用入口
│       ├── 📄 config.py        # 配置管理
│       ├── 📄 models.py        # 数据模型
│       ├── 📂 api/             # API路由
│       ├── 📂 services/        # 业务逻辑服务
│       └── 📂 middleware/      # 中间件
├── 📂 nginx/                   # Nginx配置
│   └── 📄 nginx.conf           # Nginx主配置文件
└── 📂 scripts/                 # 运维脚本
    ├── 📄 install-deps.sh      # 依赖安装脚本
    ├── 📄 backup.sh            # 备份脚本
    ├── 📄 restore.sh           # 恢复脚本
    ├── 📄 update.sh            # 更新脚本
    ├── 📄 monitor.sh           # 监控脚本
    └── 📄 test.sh              # 测试脚本
```

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建应用
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

### 代码规范

- 使用TypeScript确保类型安全
- 遵循ESLint和Prettier代码规范
- 组件采用函数式编程和Hooks
- 保持代码简洁和可读性

### 贡献指南

1. Fork本项目
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交Pull Request

## 安全注意事项

1. **合规使用**: 仅用于个人学习研究，严禁用于其他用途
2. **版权尊重**: 不用于商业用途，尊重内容创作者权益
3. **访问控制**: 设置合理的限流规则和访问控制
4. **数据保护**: 不记录用户敏感信息，定期清理临时文件
5. **安全更新**: 及时更新系统和依赖包，保持安全性

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 免责声明

本项目仅供学习和研究使用。严谨用于其他用途，尊重版权，合理使用。

---

**YTLantern** - 让YouTube观看更简单
