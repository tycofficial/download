# Monterey Intel 合并安装包

下载页：**https://tycofficial.github.io/download/**

页面在文件就绪后自动开始下载，也提供手动下载按钮。大文件存放在 GitHub Releases，不占用 Pages 站点文件。

内置 Clash Verge Rev 2.5.10 与 Codex 26.623.141536 官方旧版桌面图形应用，面向 Intel Mac / macOS Monterey 12.7.6。至少留出 4 GB 空间。首次安装可能需要 macOS 安全确认。

Codex 主程序与桌面核心框架按 macOS 12 构建；部分电脑控制等附加组件要求更高系统。未在目标 Mac 上实机验证，也未验证旧版的在线服务和登录可用性。Monterey 安装时会关闭该用户的 Codex 自动更新，避免兼容旧版被替换。

`Publish Monterey installer` 工作流从官方源下载已固定 SHA256 的原始文件，使用与本地相同的 Node.js 24.17.0 在 Windows 上生成安装包，完整验证 gzip/CPIO/XAR 及两个原始程序档案，并要求输出与原始交付文件的大小、SHA256 完全一致后才发布。

安装包 SHA256：`43d738f35254cb97612e6f88468be4b710e66b377a327ff0e09f7b60225cd2b5`

原始应用未经修改。Clash Verge 的源码快照和许可证内置。合并安装器不代表 OpenAI 或 Clash Verge Rev 官方发行。
