# Quickstart: Git 发布工作流 验证手册

**Feature**: 015-git-release-workflow
**Date**: 2026-07-09

本手册给出**端到端验证场景**,证明 spec 实现正确。每个场景独立可执行,失败时给出排错路径。

---

## 前置条件

- 仓库已 clone,工作目录在仓库根
- 已登录 `gh` CLI(`gh auth status` 显示 ✓)
- 本地 git user 与远端一致(`git config user.name` / `user.email`)
- Docker 已安装(用于 `verify-release.sh` 的 `docker manifest inspect`)
- `jq` 已安装(`jq --version`)
- 当前在 `main` 分支,工作树干净

```sh
# 一键自检
gh auth status && \
  git status --porcelain && \
  jq --version && \
  docker version --format '{{.Server.Version}}' >/dev/null && echo "all good"
```

---

## 场景 1:验证 PR 流程(对应 US1)

**目标**: 从切分支到 squash merge 的完整链路。

**步骤**:
1. 从 main 切出测试分支:
   ```sh
   git checkout main && git pull
   git checkout -b docs/verify-pr-flow
   ```
2. 改一个文档文件(如本 quickstart 加一行):
   ```sh
   echo "<!-- verify-pr-flow test marker $(date +%s) -->" >> specs/015-git-release-workflow/quickstart.md
   git commit -m "docs(015): verify PR flow marker"
   git push -u origin docs/verify-pr-flow
   ```
3. 开 PR:
   ```sh
   gh pr create --title "docs(015): verify PR flow" \
     --body "测试 PR 流程,验证后可立即合并" \
     --base main
   ```
4. 等 CI 跑完(`gh pr checks --watch`),确认 `lint` / `type-check` / `test` 三项全绿。
5. 合并:
   ```sh
   gh pr merge --squash --delete-branch
   ```

**期望结果**:
- ✅ main 上多出一条 squash commit,标题 `docs(015): verify PR flow`
- ✅ `docs/verify-pr-flow` 分支在 GitHub 上被自动删除(`git fetch --prune` 后本地消失)
- ✅ PR 状态为 `Merged`,有 "Deleted the branch" 提示

**排错**:
- 若 CI 卡住:看 `gh run list --limit 1` 的具体步骤日志
- 若 squash merge 选项不存在:仓库 Settings → General → Pull Requests → 勾选 "Allow squash merging"
- 若分支未自动删除:仓库 Settings → General → Pull Requests → 勾选 "Automatically delete head branches"

---

## 场景 2:验证 Tag 发布流程(对应 US2)

**目标**: 从改 version 到 GHCR 镜像可拉取的完整发版链路。

**注意**: 此场景**会产生真实 release**。若仅测试流程,用 `v0.0.0-test` 前缀并在测试后 `gh release delete v0.0.0-test --yes` + `git push origin :refs/tags/v0.0.0-test` 清理(但 GHCR 镜像无法删,会留痕)。**建议在 fork 上测试,或直接信任 spec 跑一次真实小版本**。

**步骤**(假设当前最新 tag 是 `v0.1.0`,本次发 `v0.1.1` —— 实际是 patch 流程,但用于演示 tag 触发):

> 若想发 `v0.2.0` 走 minor 流程,把步骤中的 `0.1.1` 替换为 `0.2.0`,并在 main 上做(不需要 release 分支)。

1. 在 main 上(或 release/v0.1 上做 patch)修改 version:
   ```sh
   # patch 流程
   git checkout release/v0.1
   # cherry-pick 或直接改文件
   ```
2. 改 `package.json` version 到 `0.1.1`:
   ```sh
   jq '.version = "0.1.1"' package.json > package.json.tmp && mv package.json.tmp package.json
   git diff  # 确认只有 version 字段变化
   ```
3. 提交 version-bump commit:
   ```sh
   git commit -am "chore(release): v0.1.1"
   ```
4. 打 annotated tag 指向该 commit:
   ```sh
   git tag -a v0.1.1 -m "Release v0.1.1

   patch release for 0.1.x line"
   ```
5. push 分支与 tag:
   ```sh
   git push origin release/v0.1
   git push origin v0.1.1
   ```
6. 创建 GitHub Release:
   ```sh
   gh release create v0.1.1 --generate-notes --latest
   ```
7. 等 GHCR 构建(`gh run list --workflow=deploy.yml --limit 3` 看 tag 触发的 run),预计 ≤ 30 分钟。

**期望结果**:
- ✅ 远端 tag `v0.1.1` 指向 version-bump commit
- ✅ GitHub Release `v0.1.1` 出现,notes 自动生成
- ✅ GHCR 上出现 `app:0.1.1` 镜像,可拉取:
  ```sh
  docker manifest inspect ghcr.io/azenking/balthasar/app:0.1.1
  ```
- ✅ `app:0.1` / `app:0` / `app:latest` 也更新到该 commit(因为 0.1.1 是 0.1.x 的最新)
- ✅ main push 的 CI 不会被触发(本次只 push 了 release 分支 + tag;若 deploy.yml 还监听 main push,也不会构建 version 镜像,因为 FR-019 要求分流)

**排错**:
- 若 GHCR 没出现 `0.1.1` 镜像:看 deploy.yml 是否真的有 `on.push.tags` 触发器 + tag job 是否跑了(`gh run view <id> --log`)
- 若 `app:latest` 没更新:tag-push job 的 `tags` 字段是否漏了 `latest`
- 若 Release notes 为空:确认上次 Release 存在(`gh release list`),`--generate-notes` 需要前一个 Release 作为起点

---

## 场景 3:验证 Patch 流程(对应 US3)

**目标**: 修复 0.1.x 线上的 bug,发 `v0.1.2`。

**前置**: `release/v0.1` 分支已存在(目前是)。

**步骤**:
1. 在 main 上修 bug(假设已修,commit 为 `<sha>`):
   ```sh
   git checkout main
   git log --oneline | grep "fix(.*):"  # 找到修复 commit
   ```
2. cherry-pick 到 release/v0.1:
   ```sh
   git checkout release/v0.1
   git cherry-pick <fix-sha>
   ```
3. 改 version 到 `0.1.2`:
   ```sh
   jq '.version = "0.1.2"' package.json > package.json.tmp && mv package.json.tmp package.json
   git commit -am "chore(release): v0.1.2"
   ```
4. 打 tag 并推送:
   ```sh
   git tag -a v0.1.2 -m "Release v0.1.2"
   git push origin release/v0.1
   git push origin v0.1.2
   gh release create v0.1.2 --generate-notes --latest
   ```

**期望结果**:
- ✅ `release/v0.1` HEAD 包含修复 + version-bump
- ✅ `v0.1.2` tag 指向 version-bump commit
- ✅ GHCR `app:0.1.2` 镜像可拉取
- ✅ Release notes 仅包含该 patch 引入的变更(不包含 main 上未发布的 feature)
- ✅ main 上**未** cherry-pick 时,该修复不会进 main —— 需要**额外**一步把 fix commit 也合并到 main(走正常 PR 流程),否则 main 与 release/v0.1 会分叉

**排错**:
- 若 cherry-pick 冲突:在 release/v0.1 上手动解决,commit 后继续
- 若 Release notes 包含了 main 上的未发布变更:说明 cherry-pick 带入了多余 commit,需 rebase 后重做

---

## 场景 4:验证校验脚本(SC-003)

**目标**: 跑 `scripts/verify-release.sh`,确认四件套一致。

**前置**: 脚本已落地(plan 阶段决策 8)。

**步骤**:
```sh
bash scripts/verify-release.sh
echo "exit=$?"
```

**期望结果**:
- ✅ 输出形如:
  ```
  package.json: 0.1.2
  latest tag:   v0.1.2
  latest release: v0.1.2
  GHCR image:   0.1.2 ✓
  All four artifacts in sync.
  ```
- ✅ 退出码 `0`
- 故意制造不一致(如改 `package.json` 但不打 tag):退出码 `非 0`,输出差异

**排错**:
- 若 `docker manifest inspect` 失败:本地未 `docker login ghcr.io`(私有镜像场景);公开镜像无需登录
- 若 `gh release view` 失败:`gh auth status` 确认登录态

---

## 场景 5:验证 main push 不构建 version 镜像(FR-019)

**目标**: 确认 main push 只产 `<short-sha>` / `edge`,**不产** `X.Y.Z` / `latest`。

**步骤**:
1. 在 main 上做一个无关变更(如改 README),push:
   ```sh
   git checkout main
   echo "<!-- test $(date) -->" >> README.md  # 假设有 README
   git commit -am "docs: trigger main push test"
   git push origin main
   ```
2. 等 CI 跑完:
   ```sh
   gh run watch
   ```
3. 看 GHCR:
   ```sh
   # 看 main push 触发的 run 里 push 了哪些 tag
   gh run view --log | grep "tags:" | head
   ```

**期望结果**:
- ✅ main-push job 只 push `<short-sha>` 与 `edge`
- ✅ **不** push `X.Y.Z` / `latest` / `X.Y` / `X`
- ✅ 当前 `app:latest` 仍指向最近一次 tag push 的 commit,不被 main push 覆盖

**排错**:
- 若 main-push 也 push 了 version tag:deploy.yml 的 `if: github.ref_type == 'tag'` 分流未生效,需检查 step-level 条件

---

## 验收检查表

完成所有 5 个场景后,逐项确认:

- [ ] 场景 1:PR 流程 main 上得到 squash commit + 短分支自动删
- [ ] 场景 2:tag push 触发镜像构建,`app:X.Y.Z` 可拉取
- [ ] 场景 3:patch 流程 GHCR 镜像与 git tag 一致
- [ ] 场景 4:`verify-release.sh` 退出 0
- [ ] 场景 5:main push 不污染 version 镜像 tag

全部勾选 → spec 实现完整,可关闭 feature。
