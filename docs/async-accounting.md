# 后台记账与结果恢复

用户发送消息后，服务器先保存用户消息和待处理状态，再返回 HTTP 202。此时页面显示“已发送”，关闭聊天页、小程序或断开客户端连接均不影响已接收任务的处理。仅点击发送、服务器尚未确认时仍显示发送中或待确认，不能保证未送达的消息已经进入后台。

## 执行与查询

- `POST /ledger-mate/ai/sessions/{session_id}/requests`：提交 `{ content, client_message_id }`。重复编号和相同内容返回原任务，不重复入账；不同内容复用编号返回冲突。
- `GET /ledger-mate/ai/sessions/{session_id}/requests/{client_message_id}`：按编号查询，结果不受最近 100 条聊天历史限制。
- `GET /ledger-mate/ai/requests/pending`：发现当前账号仍在排队或处理的请求。
- 响应 `data` 包含 `status`、`client_message_id`、`session`、`user_message`、可空的 `assistant_message` 和 `error_message`。状态为 `queued`、`processing`、`completed`、`failed`。
- 旧的同步 `POST .../messages` 保留兼容；本次前端使用新的异步接口。

应用前台有待处理消息时，在上次查询结束约 2 秒后继续查询。聊天页以外的页面也会接收完成状态；明细、资产、统计当前可见时自动刷新，隐藏页再次显示时刷新。应用进入后台暂停定时查询，回到前台立即补查。网络错误逐步退避，最长间隔 30 秒，恢复查询不会重新提交记账。

待确认内容和消息编号继续按账号保存在本地。冷启动仍遵守原有微信身份验证流程，身份恢复后查询原任务。未确认接收的请求仅可按原编号重试；已确认失败的请求可以重试，或选择“修改后重新发送”创建新编号。不同账号的迟到结果不更新当前页面或清除当前待处理消息。

## 后台保障

复用现有消息表的 `payload` 存储处理状态，不新增数据库迁移。API 提交后投递消息 UUID 给 Celery；Redis 投递暂时失败也保留已接收记录，由 Beat 每分钟扫描补投。模型调用不占用长事务，状态查询无需等待模型；独立 Worker 使用独立数据库连接。

模型调用超时 120 秒，处理租约 180 秒，自动尝试最多 3 次。重投通过会话锁、租约令牌和稳定编号保证不会重复记账；旧 Worker 失去租约后不能写入。回复、账单及关联在同一事务提交。解析“今天/昨天”使用消息最初接收时间，避免排队跨天导致记账日期漂移。基础设施恢复期间任务可能继续排队，模型多次失败则显示失败状态。

## 发布顺序

1. 在 `hope-service` 服务器发布这次后端代码，更新 API、Worker 和 Beat。已有 Redis、数据库与环境配置继续沿用，不需提供新的凭据。
2. 使用现有 Docker Compose 部署时，在服务仓库目录执行：

   ```bash
   docker compose up -d --build app celery-worker celery-beat
   docker compose ps app celery-worker celery-beat
   ```

3. 确认 Worker 注册 `apps.ledger_mate.tasks.process_ai_request`，Beat 存在 `ledger_mate_recover_ai_requests`。发布前端前先确认新的提交和状态接口可用。
4. 发布 `LedgerMate/dist/build/mp-weixin/` 中的小程序产物。仅发布前端无法启用后台处理能力。

本次仅完成代码和本地自动化验证，未执行以上服务器发布命令。

## 验收

使用测试账号发送一笔唯一备注的账目，在“已发送”后立刻退出小程序；等待处理后重开，确认回复可见且账单只有一笔。留在聊天页或切到明细/统计页时，确认结果自动显示。另检查提交回包丢失后按原编号恢复、暂时无法访问模型时的失败/重试、退出账号后旧结果不串号。

自动化使用模拟模型、内存数据库和虚拟定时器验证这些逻辑；真实微信后台/断网行为、生产 Redis 与 PostgreSQL 的多进程运行仍需部署后实测。
