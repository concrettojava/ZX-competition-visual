# MAPPO 3D Battlefield Viewer

基于原 ZX Competition Visual 的 Three.js 前端，增加一个面向 `fofe_info_mappo` 的三维战场态势可视化分支。

> 重要：三维仅用于显示。强化学习环境仍然保持 4 km × 4 km 的二维物理空间，不增加高度状态，也不改变 MAPPO 的 observation/state/reward/dynamics。

## 当前内容

- 4 km × 4 km 战场映射到 Three.js 三维场景
- 8 架异构 UAV：Stk / Rec / Com
- 4 个移动目标
- 3 个威胁区域
- 2 个动态干扰区域
- UAV 三维显示高度（仅渲染用途）
- UAV 轨迹
- 动态通信链路
- 选中 UAV 的打击、侦察、通信范围
- comm_quality / recon_quality 状态显示
- 俯视 / 透视视角、时间轴、倍速回放
- 显示层开关：轨迹、通信、威胁、干扰、范围

## 数据结构

当前：

```
Mock MAPPO World State
        ↓
src/worldState.js
        ↓
Three.js renderer
```

下一步将替换 Mock 数据源：

```
Python CooperativeUAVEnv
        ↓
WorldState snapshot / WebSocket
        ↓
Three.js renderer
```

渲染器只依赖统一 World State，不应读取强化学习环境的隐藏真值来影响策略。

## 坐标约定

RL 环境：

```
(x, y) ∈ [0, 4000] × [0, 4000] m
```

渲染：

```
RL x → Three.js X
RL y → Three.js Z
visual altitude → Three.js Y
```

其中 visual altitude 只改善三维展示，不进入强化学习状态。

## 本地运行

要求 Node.js 18+。

```bash
npm install
npm run dev
```

正式构建：

```bash
npm run build
```

## 分支

- `main`：原“智信—2026”三维可视化 Demo
- `mappo-3d-viewer`：MAPPO 战场三维可视化
