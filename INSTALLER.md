# Monterey Intel 原版独立安装文件

下载页：**https://tycofficial.github.io/download/**

当前页面提供两个独立下载按钮，停止自动下载旧合并包。文件来自原发布方，不重新封装或重新签名。大文件存放在 GitHub Releases，Pages 提供下载入口。

Clash Verge Rev 2.5.10 使用原版 Intel DMG；Codex 26.623.141536 使用 OpenAI 原版 Intel ZIP，仍为桌面图形应用。分别打开并将 app 拖入 Applications。首次打开可能需要 macOS 安全确认。

Codex 主程序与桌面核心框架按 macOS 12 构建；部分电脑控制等附加组件要求更高系统。未在目标 Mac 上实机验证，也未验证旧版的在线服务和登录可用性。下载原版文件不会修改你的系统偏好或自动更新设置；更新前请核对系统要求。

`Publish original Mac installers` 工作流在 Intel macOS 15 环境中下载原文件、核对 SHA256、检查 Developer ID、代码签名和 Gatekeeper，通过后发布未修改的原文件及验证记录。

原文件 SHA256 记录在 `publish/original-manifest.json` 和新 Release 的 `SHA256SUMS.txt`。

旧合并包因没有 Apple Developer ID Installer 签名而被替换。保留旧版记录，但不再自动构建或从主页下载。本仓库不代表 OpenAI 或 Clash Verge Rev 官方发行。
