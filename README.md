# MindTrace-Agent · 面向错因诊断的教育智能体

人工智能课程设计作业 · 学生：黎敏 · 指导教师：张茂泉

> 本仓库为课程设计成果的**在线归档与 Pull Request 展示**。完整可运行源码（Vue 3 + Vite + TypeScript，含完整 Git 提交历史）与《AI Agent 创新实践课程设计报告》Word 文档，随作业提交于本地目录 `03_学生任务/`。

## 一、项目是什么

在教师提供的 `MindTrace-Agent-main`（Vue 3 + Vite + TypeScript 单页应用，端口 5173）基础上，实现一个**不自动给学生评级**、**每条结论可追溯证据**、**最终由教师复核**的错因诊断智能体。

教师基线只有 1 个硬编码案例、3 条正则拼装反馈、2 项测试、教师端仅能查看记录。本项目保留其技术形态与原有 `feedback / diagnosis / source / mode` 行为（基线测试无回归），在其之上做增量设计。

## 二、文件归属：哪个是老师的，哪个是本人做的

| 类别 | 文件 | 说明 |
|---|---|---|
| 系统自动生成 | `.gitignore`、`LICENSE` | 建仓库时 GitHub 自动生成，与课程内容无关 |
| **教师基线原版**（`main` 分支） | `frontend/src/adapters/learning.ts`、`frontend/src/App.vue` | 老师提供的骨架：1 个硬编码案例、正则拼装反馈、教师端仅查看 |
| **教师基线 + 本人扩写**（`dev/limin`） | `frontend/src/adapters/learning.ts`、`frontend/src/App.vue` | 保留原有行为，新增证据链字段、6 类错因、2000 字符边界与降级输出、案例切换、复核按钮与统计条 |
| **本人新增**（基线中完全不存在） | `frontend/src/adapters/ruleEngine.ts`、`cases.ts`、`review.ts`、`studentModules.test.ts` | 表驱动规则引擎、多案例任务库、教师复核闭环、回归测试 |
| **本人撰写文档** | `COURSE_CHANGES.md`、`TEST_REPORT.md` | 基线/本人贡献逐项对照、T01–T04 实测记录 |

**结论**：`dev/limin` 不是教师源代码原样复制，而是「教师骨架 + 本人增量设计」；`main` 保留教师原版以便逐行对比。逐项对照见 [`COURSE_CHANGES.md`](COURSE_CHANGES.md)。

## 三、本次本人新增（基线中不存在）

| 新增模块 | 文件 | 作用 |
|---|---|---|
| 表驱动错因规则引擎 | `frontend/src/adapters/ruleEngine.ts` | 规则带 id/类别/关键词/权重/反例词/依赖，可整体替换；输出命中明细、加权置信度、矛盾检测、21pt 数值核对 |
| 多案例任务库 | `frontend/src/adapters/cases.ts` | 3 个案例，其中「数据泄漏」「类别不平衡」为本人新增；CASE-001 明确标注教师基线 |
| 教师复核闭环 | `frontend/src/adapters/review.ts` | 采纳/驳回 + 复核意见 + 按错因回流统计 |
| 诊断单证据链 | `frontend/src/adapters/learning.ts` | `evidence_chain` 每条含 claim/source/ref/value/verified；6 类错因；2000 字符边界与降级输出 |
| 页面交互 | `frontend/src/App.vue` | 案例切换、证据链展示、复核按钮与统计条 |
| 测试 | `learning.test.ts`、`studentModules.test.ts` | 由基线 2 项扩充至 **32 项** |

## 四、学术诚信约束

所有记录 `need_review=true`、`review_status=pending_teacher_review`；系统不自动评级，采纳/驳回只能由教师在界面操作；页面数据均为 DEMO/SAMPLE，结论标注 `not_verified`；不调用外部模型或生产服务，无 API 密钥。规则未覆盖时只输出「未覆盖」并转教师复核，不编造诊断。

## 五、真实实测结果

| 项目 | 结果 |
|---|---|
| `npm run build` | 通过，0 错误 |
| `npm test` | **32 / 32 全部通过**（基线 2 项无回归） |
| 单次诊断耗时 | 0.0180 ms（2000 次采样） |
| 本地 Git 提交 | 基线 `aa38370` → 本人改进 `3ba5a81` |
| 运行截图 | 诊断单证据链、教师复核统计、本人新增案例、真实构建/测试日志（本地 `evidence/E01–E05`） |

详见 [`TEST_REPORT.md`](TEST_REPORT.md)。

## 六、本地运行（完整源码）

```bash
cd 03_学生任务/mindtrace-agent/frontend
npm install
npm run dev      # http://127.0.0.1:5173/
npm test
```

演示快捷入口：`/?demo=1`（诊断单与证据链）、`/?role=teacher&demo=1`（教师复核与统计）、`/?case=CASE-002&demo=1`（本人新增案例「数据泄漏」）。

## 七、分支与提交方式

- `main`：教师基线原版，作为对比基准。
- `dev/limin`：本人改进分支，PR 展示其相对 `main` 的全部改动。
- GitHub 网页端上传不支持保留子目录结构，故本仓库以网页「新建文件」方式收录核心文件；完整目录结构与二进制证据（截图、报告文档）以本地交付目录为准。
