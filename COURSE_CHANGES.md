# 课程设计改动清单：本人工作 vs 教师基线

> 本文件用于明确区分「教师提供的内容」与「本人新增的内容」。
> 教师提供的 `MindTrace-Agent-main` 是课程要求的**已有代码仓库/起点**，本项目在其之上做改进；
> 报告正文不复制、不复述基线 README / docs 的说明文字，基线只在「基线分析」环节作事实性审计。

## 1. 基线审计（只列事实，不展开）

| 项 | 教师基线状态 |
|---|---|
| 技术形态 | Vue 3 + Vite + TypeScript 单页应用，端口 5173（`strictPort: true`），无独立后端 |
| 数据入口 | `frontend/src/adapters/learning.ts` 中本地 `analyse()`，数据存 localStorage |
| 案例 | **1 个**：猫狗分类过拟合；题干、99%/78%/21pt 指标直接写死在 `App.vue` 模板 |
| 错因判断 | `analyse()` 内 3 个硬编码正则（概念 / 证据 / 行动），按布尔组合拼 4 种反馈文本 |
| 记录字段 | `EvidenceRecord` 8 字段：`id/student/answer/feedback/diagnosis/source/mode/createdAt` |
| 教师视图 | 只能查看、清空本机记录；无采纳/驳回、无状态、无统计 |
| 测试 | `learning.test.ts` 共 2 项 |
| 运行基线 | `npm run build` 退出码 0；`npm test` 2 passed |

基线证据：`evidence/baseline_build.txt`、`evidence/baseline_test.txt`、`evidence/baseline_record.json`（真实执行基线 `analyse()` 导出）。

## 2. 本人新增设计（基线中不存在）

| # | 模块 / 文件 | 具体内容 | 基线是否有 |
|---|---|---|---|
| ① | `frontend/src/adapters/ruleEngine.ts` | **表驱动错因规则引擎**：规则含 id / 类别 / 关键词 / 权重 / 反例词 / 依赖规则；输出命中明细、加权置信度、矛盾（反例）检测、数值差距核对（21pt）、分类依据；`evaluate(text, customRules)` 支持整体替换规则集 | 无 |
| ② | `frontend/src/adapters/cases.ts` | **多案例任务库**：3 个案例，CASE-001 标注「教师基线」，CASE-002 数据泄漏、CASE-003 类别不平衡标注「本人新增」；含题干、指标、诊断重点、预期错因类别 | 无（基线只有 1 个硬编码案例） |
| ③ | `frontend/src/adapters/review.ts` | **教师复核闭环与回流统计**：`submitReview()` 采纳/驳回 + 复核意见，独立留存复核记录；`reviewStats()` 输出待复核/已采纳/已驳回、平均证据条数、按错因类别分布 | 无 |
| ④ | `frontend/src/adapters/learning.ts`（扩展） | 新增 `classify()` 纯函数（6 类错因）、`evidence_chain`（每条结论含 claim/source/ref/value/verified）、`evidence_summary`、`notice`；新增 2000 字符上限、控制字符剔除、规则未覆盖降级、数值错误识别；**保留基线 feedback / diagnosis / source / mode / localStorage KEY 不变** | 部分（原文件存在，字段全为新增） |
| ⑤ | `frontend/src/App.vue`（扩展） | 案例切换（3 案例）、证据链区块展示、错因类别与规则置信度、教师复核按钮 + 统计条、DEMO 快捷入口 | 部分 |
| ⑥ | `learning.test.ts` + `studentModules.test.ts` | 2 项 → **32 项**；新建测试文件覆盖上述三个新模块 | 部分 |
| ⑦ | `frontend/tsconfig.json`、`package.json` | 增加 `@types/node`，使测试可读取真实基线证据文件 | 无 |
| ⑧ | `docs/COURSE_CHANGES.md`、`docs/TEST_REPORT.md`、`evidence/` | 改动清单、实测报告、5 张运行证据图与日志 | 无 |

## 3. 明确未做（学术诚信边界）

- **不自动给学生评级**：所有诊断记录 `need_review = true`、`review_status = 'pending_teacher_review'`；采纳/驳回只能由教师在界面上做出，规则引擎不写入评级。
- **不调用外部模型 / 生产服务**：全部为本地确定性规则计算，无 API 密钥、无网络请求；`.env.example` 保持为空。
- **不编造证据**：`evidence_chain` 每条结论必须挂接规则 id 或作答原文；规则未覆盖时只输出「未覆盖」并转教师复核，不生成完整诊断。
- **标注样例性质**：全部输入与展示数据为 DEMO / SAMPLE，结论标注 `not_verified`，页面保留「未连接生产服务」提示。
- **未实际运行的能力不标注「已执行」**：本报告所有实测数字均来自 `npm run build`、`npm test` 与 Node 采样命令的真实输出。

## 4. 改动文件清单

```
frontend/src/adapters/ruleEngine.ts          (新增)
frontend/src/adapters/cases.ts               (新增)
frontend/src/adapters/review.ts              (新增)
frontend/src/adapters/studentModules.test.ts (新增)
frontend/src/adapters/learning.ts            (扩展，保留基线行为)
frontend/src/adapters/learning.test.ts       (扩展，2 → 17 项)
frontend/src/App.vue                         (扩展)
frontend/tsconfig.json                       (types 增加 node)
frontend/package.json / package-lock.json    (devDependency: @types/node)
README.md                                    (追加第 8–10 节)
docs/COURSE_CHANGES.md                       (新增)
docs/TEST_REPORT.md                          (新增)
evidence/*                                   (运行证据)
```

## 5. 迭代反思

| 已解决 | 未解决 / 下一步 |
|---|---|
| 基线反馈无依据 → 证据链可回溯 | 规则为关键词匹配，无语义理解；下一步引入向量检索或经授权的小模型做语义分类 |
| 单案例、规则写死 → 案例库与规则集可配置 | 案例仅 3 个，覆盖面有限；补充更多学科案例与教师标注样本 |
| 教师只能查看 → 复核闭环与回流统计 | 回流数据目前只做计数统计，尚未用于自动优化规则权重 |
| 无边界与降级处理 → 输入校验、反例检测、未覆盖降级 | 复核结果尚未持久化到服务端；当前仅本机 localStorage |
