# Server 分支 vs Main 分支对比分析报告

生成时间: 2026-02-06

## 📊 总体统计

- **Main 分支领先提交数**: ~100+ commits
- **Server 分支独有提交数**: 11 commits
- **文件变更**: 165 个文件
- **代码变更**: +121,217 行 / -23,245 行

---

## 🎯 Server 分支独有功能（Main 没有的）

### 1. **后端服务集成** ⭐⭐⭐
- **文件**: `src/api/index.js`
- **功能**: 完整的后端 API 集成
  - 用户认证 (login/register/profile)
  - BIN 文件管理 (上传/列表/删除)
  - 存储服务 (key-value)
  - 活动日志
  - 战绩导出
  - 管理员功能
- **价值**: 支持多用户、数据持久化、权限管理

### 2. **管理员用户管理界面** ⭐⭐⭐
- **文件**: `src/views/AdminUsers.vue`
- **功能**:
  - 查看/删除普通用户
  - 管理用户 BIN 文件
  - 密码重置（带 RSA 加密）
  - 用户 BIN 文件下载
- **价值**: 完整的后台管理能力

### 3. **Server 分支特有修复**
- 修复登录逻辑 (316bcd9)
- 添加 Excel 模板导出 (a7bfc9a)
- 修复获取 token (2e77593)
- 修复怪异塔 (f4e9cee)
- 添加编译打包脚本 (4b567ed)
- 修复淬炼错误 (4575ae0)
- 修复阵容刷新问题 (48c3bb4)
- 添加 JJC 筛选 (ca90c3d)
- 更改日志位置 (c887af9)
- 添加任务设置保存 (65c6817)

---

## 🚀 Main 分支新增功能（Server 没有的）

### 🔥 高优先级（强烈建议移植）

#### 1. **性能优化三件套** (f86599d - 15小时前)
- **cache.ts 缓存库**
  - 文件: `src/stores/cache.ts` (173 行)
  - 功能: Promise 缓存、超时管理、防重复请求
  - 价值: 显著提升性能，减少重复请求

- **Events 事件系统重构**
  - 原文件: `src/stores/events/index.ts` (264 行 → 主逻辑)
  - 拆分为:
    - `src/stores/events/ack.ts` - ACK 确认
    - `src/stores/events/activity.ts` - 活动事件
    - `src/stores/events/chat.ts` - 聊天消息
    - `src/stores/events/hangup.ts` - 挂机事件
    - `src/stores/events/legion.ts` - 军团事件
    - `src/stores/events/role.ts` - 角色信息
    - `src/stores/events/team.ts` - 队伍事件
    - `src/stores/events/tower.ts` - 塔相关事件
  - 价值: 代码模块化，易维护，易扩展

- **WebSocket debounceSend 防抖**
  - 文件: `src/utils/xyzwWebSocket.js`
  - 功能: 短时间内重复请求合并（如 `role_getroleinfo`）
  - 实现: 基于 cache.ts 的智能缓存
  - 价值: 减少服务器压力，提升响应速度

#### 2. **Token MD5 Hash 优化** (6452b33 - 19小时前)
- **文件**: `src/utils/token.ts`
- **功能**: 使用 MD5 hash 作为 token ID，避免名字重复
- **依赖**: crypto-js 库
- **价值**: 解决 token 重复问题，更可靠的唯一标识

#### 3. **批量任务大幅增强** (BatchDailyTasks.vue)
- **代码量**: 2,719 行 → 8,265 行 (+5,546 行)
- **新功能**:
  - 并发连接执行任务 (e1b9147)
  - 任务执行倒计时显示
  - 失败任务详情弹窗 (e0d0e4a)
  - 任务模板系统 (fc3c715)
  - 定时任务管理
  - 任务执行状态跟踪 (18d97a1)
  - 连接限流功能
- **价值**: 大幅提升批量任务的可用性和稳定性

### 🎯 中优先级（建议移植）

#### 4. **微信扫码登录** (d395dc8)
- **文件**: `src/views/TokenImport/wxqrcode.vue` (新增)
- **功能**: 微信扫码获取最近登录角色 Token
- **价值**: 更便捷的 Token 导入方式

#### 5. **Token 管理增强**
- **Token 拖动排序** (969f6b5)
  - 文件: `src/views/TokenImport/index.vue`
  - 功能: 拖拽调整 Token 顺序

- **Token 备注支持** (6fb4c7a)
  - 功能: 为每个 Token 添加备注信息
  - 字段: `remark`, `importMethod`, `sourceUrl`, `upgradedToPermanent`

- **Bin 导入默认长期** (7b80545)

#### 6. **错误处理优化**
- **错误码映射** (8412e3e)
  - 文件: `src/utils/xyzwWebSocket.js`
  - 功能: 将错误码转换为可读文本

- **报错码明文显示** (acee453)
  - 日常任务执行时显示错误详情

### 📦 低优先级（可选功能）

#### 7. **实时盐场功能** (503ffdb, 16a8339)
- **文件**:
  - `src/views/LegionWar.vue` (新增 863 行)
  - `src/utils/legionWar.js` (新增 2,150 行)
  - `src/utils/xyzwLegionWarWebSocket.js` (新增 717 行)
- **功能**: 实时盐场数据查询和展示
- **价值**: 如果需要盐场功能则必须移植

#### 8. **蟠桃园功能** (7e89eea, 29a5ed6)
- **文件**:
  - `src/components/Club/PeachInfo.vue` (新增 417 行)
  - `src/components/Club/PeachBattleRecords.vue` (新增 1,460 行)
- **功能**: 蟠桃园活动数据查询
- **价值**: 游戏特定功能

#### 9. **俱乐部功能增强**
- **本月盐场战绩** (c0697a3)
  - `src/components/Club/ClubMonthBattleRecords.vue` (新增 860 行)

- **俱乐部怪异塔** (66d3afb)
  - `src/components/Club/ClubWeirdTowerInfo.vue` (新增 482 行)

- **赛车积分信息** (835719f)
  - `src/components/Club/CarScoreInfo.vue` (新增 441 行)

- **申请列表管理** (37cdbbc, c767949)

#### 10. **赛车系统优化**
- 车辆发车逻辑优化 (049caf4)
- 车辆品阶保底设置
- 车辆奖励展示 (65477fd)
- 一键收车增加赛车改装 (3c48651)

#### 11. **装备系统**
- 装备淬炼功能增强 (f1dfe72)
  - 多条件设置
  - 密码验证
  - **注意**: Server 已有淬炼功能，需对比差异

#### 12. **UI/UX 改进**
- 战绩展示重构 (cee3b4c, e9b0493)
- 成员排名显示 (95b7808)
- 暗黑模式优化 (ba7e517)

#### 13. **大型依赖文件**
- `src/xyzw/cocos2d-js-min.js` (41,978 行)
- `src/xyzw/index.js` (37,134 行)
- `src/xyzw/game-defines.js` (7 行)
- **用途**: 未知，需要调查
- **风险**: 增加打包体积

---

## ⚠️ 潜在冲突和注意事项

### 1. **tokenStore.ts 大量变更**
- Main 分支对 tokenStore 进行了重构
- Server 分支可能有自己的修改
- **建议**: 仔细对比差异，手动合并

### 2. **events/index.ts 架构变化**
- Main 分支将事件拆分到多个文件
- Server 分支仍是单文件结构
- **建议**: 优先移植 events 重构，提升代码质量

### 3. **BatchDailyTasks.vue 巨大差异**
- Main: 8,265 行
- Server: 2,719 行
- **建议**: 需要详细对比功能差异，可能需要重写或大量合并

### 4. **装备淬炼功能重复**
- Server 已有淬炼功能
- Main 也有淬炼增强
- **建议**: 对比 `src/components/cards/RefineHelperCard.vue` 差异

### 5. **依赖包变更**
- Main 可能新增了依赖 (crypto-js, 其他)
- **建议**: 对比 `package.json` 和 `pnpm-lock.yaml`

---

## 📋 推荐移植优先级

### 第一批（核心优化，必须移植）
1. ✅ **cache.ts 缓存库** - 性能基础设施
2. ✅ **Events 事件系统拆分** - 代码质量提升
3. ✅ **debounceSend 防抖** - 性能优化
4. ✅ **MD5 Token Hash** - 修复重复问题

**预计工作量**: 2-3 小时
**风险**: 低，独立模块
**收益**: 高，性能和稳定性显著提升

### 第二批（功能增强）
5. ✅ **批量任务增强** - 核心功能改进
6. ✅ **Token 管理增强** (拖动排序、备注)
7. ✅ **错误码映射** - 用户体验提升

**预计工作量**: 4-6 小时
**风险**: 中，可能与 Server 现有代码冲突
**收益**: 高，用户体验大幅提升

### 第三批（可选功能）
8. ⚪ **微信扫码登录** - 如果需要
9. ⚪ **实时盐场** - 如果需要
10. ⚪ **蟠桃园** - 如果需要
11. ⚪ **俱乐部增强** - 根据需求

**预计工作量**: 按需
**风险**: 低，独立功能
**收益**: 取决于需求

---

## 🔍 需要进一步调查

1. **src/xyzw/** 目录的用途
   - 79,000+ 行代码
   - 可能是游戏引擎相关
   - 需要确认是否必要

2. **Server 后端集成保留策略**
   - Server 的后端功能是否需要保留
   - 如何与 Main 的新功能共存

3. **装备淬炼功能对比**
   - 详细对比两个分支的实现差异
   - 决定保留哪个版本或合并

---

## 🛠️ 建议的移植流程

### 方案 A: 渐进式移植（推荐）
1. 创建新分支 `server-merge-main`
2. 逐个移植第一批功能
3. 测试验证
4. 移植第二批功能
5. 测试验证
6. 根据需求移植第三批

### 方案 B: 大合并
1. 尝试 `git merge origin/main`
2. 解决所有冲突
3. 全面测试

**推荐**: 方案 A，风险更低，更可控

---

## 📝 移植检查清单

- [ ] 安装新依赖 (crypto-js 等)
- [ ] 移植 cache.ts
- [ ] 移植 events 拆分
- [ ] 移植 debounceSend
- [ ] 移植 MD5 token hash
- [ ] 对比 tokenStore.ts 差异
- [ ] 对比 BatchDailyTasks.vue 差异
- [ ] 对比 RefineHelperCard.vue 差异
- [ ] 测试 WebSocket 连接
- [ ] 测试批量任务
- [ ] 测试 Token 管理
- [ ] 回归测试所有功能

---

## 📞 需要决策的问题

1. **是否需要实时盐场功能？**
2. **是否需要蟠桃园功能？**
3. **是否需要微信扫码登录？**
4. **src/xyzw/ 目录是否需要？**
5. **Server 后端功能如何与新功能集成？**
6. **装备淬炼使用哪个版本？**

---

**报告生成完毕。建议先从第一批核心优化开始移植。**
