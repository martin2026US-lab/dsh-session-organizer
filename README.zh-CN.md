# dsh-session-organizer

[English](README.md)

这是一个非官方的 DeepSeek Harness Web 社区插件，为界面增加一个尽量克制的会话整理层：置顶常用会话，并从官方“已归档会话”页面安全地永久删除不再需要的记录。

> 本项目由社区独立开发，与 DeepSeek 没有隶属或官方背书关系。

## 界面预览

| 会话二级菜单 | 永久删除安全确认 |
| --- | --- |
| ![带有置顶操作的会话菜单](docs/images/session-actions-zh.png) | ![永久删除确认框](docs/images/delete-confirmation-zh.png) |

## 功能

- 在每个会话的二级操作菜单中加入“置顶对话 / 取消置顶”。
- 在工作区列表顶部显示紧凑的“置顶”栏目，并与普通会话列表共用同一滚动区域。
- 置顶会话按所属工作区连续分组；每组只显示一次带文件夹图标的醒目工作区名称。
- 当新增的置顶操作使二级菜单超出窗口时，自动调整菜单位置以完整显示。
- 同一工作区内支持拖动排序；不会用拖动悄悄改变会话的工作区归属。
- 在官方“设置 → 已归档会话”列表的“取消归档”后加入红色“删除”按钮。
- 永久删除前显示红色二次确认界面。

## 安全模型

永久删除只接受同时满足以下条件的会话：

1. 会话仍属于 Harness 的全局归档集合；
2. 若会话正显示在主对话区，插件会先在原工作区打开一个空白新会话；若目标仍有运行中的任务，只取消并等待该目标会话进入空闲；
3. 持久化后端能够返回该会话的实际日志路径；
4. 解析后的会话目录严格位于 Harness 默认 `sessions` 根目录内。

Harness `0.1.6-alpha.2` 暂未公开“关闭单个服务端会话”的接口。对默认 JSONL 持久化后端，插件会在目标会话空闲后先强制落盘，并通过特性检测只关闭该会话的活动写入句柄；不会重启 Harness，也不会停止其他会话。随后目标目录会被重命名为同目录隔离项，再更新工作区与归档状态；任何中间步骤失败都会尝试恢复目录及工作区关系。删除不可撤销，请仍然把重要会话当作重要数据备份。

如果活动会话在关闭写入句柄后删除失败，插件会先恢复隔离目录，再重新打开该会话的同一持久化写入通道，然后才把错误返回给界面，避免失败后的活动会话继续运行却不再落盘。

已成功删除但仍由当前 Harness 进程暂时保留的内存会话会被标记并从客户端目录持续过滤，不会重新出现在“未分组”中。插件也会识别并清理旧版本留下的“无工作区归属且持久化记录已不存在”的目录残留。

如果目标会话由无法安全停止的其他生命周期持有，或其存储锁无法释放，插件仍会拒绝删除，而不会强行移除正在使用的日志。

## 安装

要求 DeepSeek Harness `0.1.6-alpha.2` 与 Node.js 24 或更高版本。

从 GitHub 安装：

```powershell
dsh plugin --profile web add github:martin2026US-lab/dsh-session-organizer
```

从本地源码安装：

```powershell
dsh plugin --profile web add <此项目的绝对路径>
```

从 npm 安装（未来发布到 npm 后）：

```powershell
dsh plugin --profile web add dsh-session-organizer
```

安装后请重启 Web profile。卸载插件：

```powershell
dsh plugin --profile web remove dsh-session-organizer
```

配置和会话根目录均由 Harness 运行时解析。插件源码不依赖固定用户名、盘符或自定义 DSH 路径。置顶状态保存在：

```text
<DSH_HOME>/plugins/dsh-session-organizer/pins.json
```

## 验证

```powershell
npm run verify
```

建议在发布前执行一次实际 Web UI 回归：置顶、取消置顶、组内拖动、打开删除确认框并取消。除非已经准备了专用测试会话，不要在自动化回归中确认永久删除。

## 兼容性说明

Harness `0.1.6-alpha.2` 尚未提供会话行菜单扩展槽或工作区列表顶部插槽。插件的数据读写与导航使用 Harness 服务；两个精确的展示位置通过带清理生命周期的 DOM 兼容层接入。`engines.dsh` 因此锁定当前验证版本，升级 Harness 后应先重新执行 UI 回归。

## 参与贡献

欢迎提交问题和范围明确的 Pull Request。报告问题时请注明准确的 Harness 版本、浏览器、操作系统、复现步骤和相关日志。请勿上传未经脱敏的会话日志、凭据或个人内容。

安全敏感问题请参阅 [SECURITY.md](SECURITY.md)，版本变化参阅 [CHANGELOG.md](CHANGELOG.md)。

许可证：MIT。
