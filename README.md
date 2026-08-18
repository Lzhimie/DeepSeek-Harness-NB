# DeepSeek Harness NB
<div align="center">

# 🚀 国内 Token 中转站

## 高速稳定 · 简单易用 · 面向 AI 创作者与开发者

<br>

<a href="https://lzhimie.top">
  <img src="https://img.shields.io/badge/立即访问-lzhimie.top-FF4D4F?style=for-the-badge&logo=googlechrome&logoColor=white" alt="国内 Token 中转站">
</a>

<br>
<br>

### 🔗 官网地址：<a href="https://lzhimie.top">https://lzhimie.top</a>

</div>


## 下载

> ⚠️ **仅支持 Windows 系统**（Windows 10 / 11，64 位）。macOS 与 Linux 暂不支持。

- **[下载 ZIP 便携版](https://github.com/Lzhimie/DeepSeek-Harness-NB/releases/latest/download/DeepSeek-Harness-Portable-0.1.1.zip)**：解压后运行 `启动.bat`。
- **[下载 EXE 安装版](https://github.com/Lzhimie/DeepSeek-Harness-NB/releases/latest/download/DeepSeek-Harness-Setup-0.1.1.exe)**：免管理员安装，安装后通过桌面快捷方式启动。
- [查看所有版本与更新日志](https://github.com/Lzhimie/DeepSeek-Harness-NB/releases)

为 **DeepSeek Harness** 桌面端提供社区插件生态与一键发行包构建工具的扩展项目。

> ⚠️ 说明：DeepSeek Harness 主程序本体（`DeepSeek Harness.exe`、`resources/app.asar`、`resources/host`）是第三方闭源 Electron 应用，**不在本仓库提供**。本仓库包含的是配套的**社区插件中心扩展源码**与**发行包构建工具**，以及发行包（ZIP 便携版 / EXE 安装程序）的构建方法。
>
> 这个是为了方便自己,做了一个整合,算是个整合包,我整合了几个常用的插件,重点对背景皮肤进行优化,可以让界面更美观.
> 尤其添加了输入框的背景皮肤设置,很舒服.

## 功能

- **社区插件中心**：GitHub 插件市场、安装 / 卸载 / 禁用 / 更新、多镜像源、分页搜索、monorepo 子包安装
- **皮肤引擎**：自定义皮肤市场、背景图片 / 视频、输入框背景（填充 / 适应 / 拉伸 / 平铺 / 居中 / 跨区）、AI 回复与消息气泡颜色、展开框背景（透明度 / 模糊 / 颗粒）
- **自动更新**：启动后从 GitHub 同步插件、12 小时节流、可开关
- **便携初始化**：ZIP 解压即用 / EXE 一键安装，首次启动自动完成插件链接与依赖链接初始化，与用户系统 profile 隔离
- **发行包构建**：生成 `DeepSeek-Harness-Portable-*.zip` 与 `DeepSeek-Harness-Setup-*.exe`

## 目录结构

```
DeepSeek-Harness-NB/
├── lib/                     # 社区插件中心源码
│   ├── client.js            #   浏览器端（皮肤面板、插件面板 UI）
│   ├── core.js              #   宿主核心（安装/更新/自愈/依赖解析）
│   └── index.js             #   HTTP 路由（/community/*）
├── scripts/                 # 构建与初始化脚本
│   ├── build-package.mjs    #   组装便携发行目录（robocopy + 白名单过滤）
│   ├── portable-fixup.mjs   #   首次运行初始化（junction 链接、profile 种子）
│   ├── 启动.bat             #   便携版启动入口（初始化 + 启动）
│   ├── install-prebuilt.mjs #   预构建包安装
│   ├── link-deploy.js       #   开发环境部署链接
│   ├── make-fixtures.mjs    #   测试夹具
│   └── cdp-inspect.mjs      #   Chrome DevTools 调试辅助
├── pack/                    # 发行包工具
│   ├── make-zip.mjs         #   生成便携 ZIP
│   ├── installer-short.nsi  #   NSIS 安装程序脚本（免管理员、用户目录安装）
│   └── installer.nsi        #   NSIS 脚本参考版本
├── test-core.mjs            # 插件中心核心逻辑测试
└── package.json             # 插件中心包定义
```

## 构建发行包

环境要求：Windows 10+、Node.js 18+、robocopy（系统自带）、NSIS 3.x。

```powershell
# 1. 组装便携发行目录（源程序目录在 build-package.mjs 顶部配置）
node scripts/build-package.mjs

# 2. 生成 ZIP 便携版
node pack/make-zip.mjs

# 3. 生成 EXE 安装程序（需 NSIS，脚本内配置了 makensis 路径）
makensis pack/installer-short.nsi
```

产物输出到项目输出目录（`DeepSeek Harness 聚合`）：

- `DeepSeek-Harness-Portable-<版本>.zip`：解压后运行 `启动.bat` 即可使用
- `DeepSeek-Harness-Setup-<版本>.exe`：免管理员安装，安装完成自动初始化

## 使用

- **ZIP 便携版**：解压到任意目录 → 双击 `启动.bat`（不要直接双击 `DeepSeek Harness.exe`）
- **EXE 安装版**：双击安装 → 桌面快捷方式启动
- **安装插件 / 皮肤**：在应用内打开社区插件中心，搜索 GitHub 仓库即可安装
- 发行包默认内置 7 个功能插件（Git 图 / 任务看板 / 实时统计 / Aegis / auto-mode / modlens / better-sidebar），不包含皮肤与个人数据，皮肤可在插件中心按需下载

## 测试

```powershell
node test-core.mjs
```

## 许可证

本项目扩展部分代码按 [MIT License](LICENSE) 发布
