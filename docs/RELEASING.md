# 发布流程

本仓库使用 release-it 统一完成 GitHub 发布。npm 发布由维护者手动操作，脚本不会运行 npm publish。

## 准备

- 使用 Node.js 24.15.0 或更高的受支持版本，运行 `npm ci`。
- 使用 `gh auth login` 登录有仓库写权限的 GitHub 账号；也可设置 `GITHUB_TOKEN`。
- 在 `master` 上完成修改，更新 `CHANGELOG.md` 中目标版本的条目，提交所有文件。不要先单独运行 `git push`。

## 一条命令发布

```bash
# 常规修复发布：例如 0.1.2 → 0.1.3
npm run release

# 功能版本、主要版本或指定版本
npm run release -- minor
npm run release -- major
npm run release -- 0.2.0

# package.json 已是目标版本时，补发该版本
npm run release -- --current

# 预览流程，不修改版本、不推送、不创建 Release
npm run release -- --current --dry-run
```

脚本依次运行构建、测试与 lint，检查分支、工作区、远端和版本说明，同步 package.json/package-lock.json，生成安装包与 SHA-256 校验文件，提交版本变更、创建 `v版本号` tag，原子推送分支和 tag，创建 GitHub Release 并上传两个附件。最后核对远端提交、tag 和附件校验值；只有全部成功才算发布完成。

release-it 的 dry-run 只预览写入步骤和检查计划，不代表测试、打包或实际发布已经通过。

产物保存在 `.local/releases/版本号/`，不会提交到 Git。GitHub token 只传给本次发布进程，不写入配置或日志。发布工具仅为开发依赖，不进入节点运行时。

## 中途失败

查看失败步骤及 `git status`。修复问题后，先确认 package.json 的版本和本地／远端 tag：若版本已递增，应使用 `npm run release -- --current` 继续同一版本，避免再次递增。已有 tag 必须指向当前提交，脚本不会强制移动 tag。

若需修改已经发布版本的代码，请发布新版本，不要覆盖旧 tag。推送和 GitHub Release 是两个独立服务，网络故障仍可能造成前者成功、后者失败；最终核验用于发现这种不完整发布。
