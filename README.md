# ZX Competition Visual

“智信—2026”无人智能挑战赛三维实时可视化 Demo。

当前 Demo：
- 三个科目场景切换
- 场景初始化
- Agent 初始化（当前使用 Mock 数据，真实接口待对接）
- 6 架无人机三维运动
- 科目一目标动态出现
- 科目二投送目标展示
- 科目三抽象树林与感知障碍物展示
- 播放 / 暂停 / 时间轴拖动 / 倍速回放
- 轨迹显示与无人机状态面板

## 本地运行

要求：Node.js 18+（推荐 20 LTS）

```bash
npm install
npm run dev
```

然后浏览器打开 Vite 输出的本地地址，通常是：

```
http://localhost:5173
```

## 当前数据架构

当前：MockData -> World State -> Three.js

后续联调目标：
- MAVLink / ROS / WebSocket / 自定义协议
- 统一转换为 AgentState / TargetState / ObstacleState
- 可视化层保持不变
