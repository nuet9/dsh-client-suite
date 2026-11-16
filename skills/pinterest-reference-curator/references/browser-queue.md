# 队列调用与边界

以当前 pinterest_queue / pinterest_research 工具 schema 和主 SKILL.md 为准。来源旧版操作顺序可能不同，升级后先核对。

1. 活跃工具箱任务所有者 begin(jobId,startedAt) 获得 queueId；绑定既有授权目标用 bind，新建授权目标用 create。
2. 使用专用 pinterest_research 启动最多三名只读研究者。研究者只能 queue search → 实际读取返回截图 → enqueue 已审核候选，不直接调用 Playwright/tabs、创建浏览器脚本或修改账号。
3. 所有者 drain(auto:true) 开启串行保存；候选持久记录、恢复和停止行为以真实回执为准，只有 verified/真实保存结果计入本轮数量。共享队列不是浏览器账号隔离。
4. finish 停止保存并获取一次预览，report 后 close 自有页。原轮截止不延长，未验证保存不盲重放；用户明确继续才由原所有者 resume 新一轮。

全轮 600 秒：8 分钟停新搜，9 分 30 秒停新收藏，10 分钟交付实际数量。登录、验证码或首次浏览器启动失败即时说明，不切日常 Chrome。基线去重是有界读取，大图版不得声称全量去重。
