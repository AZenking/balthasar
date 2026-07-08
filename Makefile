# BALTHASAR Makefile.
# 封装常用运维操作,避免长 docker compose 命令。
#
# 用法:
#   make simple-up           # 启动简易部署
#   make simple-down         # 停止 (保留卷)
#   make simple-logs         # 查看 app 日志 (-SVC=postgres 看 db)
#   make simple-ps           # 查看容器状态
#   make simple-backup       # 备份到 ./backups/ (BACKUP_DIR= 改路径)
#   make simple-restore DATE=YYYY-MM-DD
#   make simple-upgrade TAG=0.2.0

SIMPLE_COMPOSE := deploy/simple/docker-compose.simple.yml
SIMPLE_ENV     := deploy/simple/.env

.PHONY: simple-up simple-down simple-logs simple-ps simple-backup simple-restore simple-upgrade

simple-up:
	@echo "[simple-up] 启动 balthasar (postgres + app) ..."
	@docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) up -d
	@echo "[simple-up] 完成。访问 http://localhost:$$(grep ^APP_PORT $(SIMPLE_ENV) | cut -d= -f2 | tr -d ' ' || echo 3000)"

simple-down:
	@echo "[simple-down] 停止 balthasar (保留数据卷) ..."
	@docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) down

simple-logs:
	@SVC="$(or $(SVC),app)"; \
	echo "[simple-logs] 跟踪 $$SVC 日志 (Ctrl+C 退出) ..."; \
	docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) logs -f --tail=100 $$SVC

simple-ps:
	@docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) ps

simple-backup:
	@BACKUP_DIR="$(or $(BACKUP_DIR),$$(grep ^BACKUP_DIR $(SIMPLE_ENV) | cut -d= -f2 | tr -d ' ' || echo ./backups))"; \
	FILE="backup-$$(date +%F).sql.gz"; \
	mkdir -p $$BACKUP_DIR; \
	echo "[simple-backup] 导出到 $$BACKUP_DIR/$$FILE ..."; \
	docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) exec -T postgres \
		pg_dump -U "$$(grep ^POSTGRES_USER $(SIMPLE_ENV) | cut -d= -f2 | tr -d ' ')" \
				"$$(grep ^POSTGRES_DB $(SIMPLE_ENV) | cut -d= -f2 | tr -d ' ')" \
		| gzip > $$BACKUP_DIR/$$FILE; \
	ls -lh $$BACKUP_DIR/$$FILE

simple-restore:
	@if [ -z "$(DATE)" ]; then echo "用法: make simple-restore DATE=YYYY-MM-DD"; exit 1; fi
	@BACKUP_DIR="$(or $(BACKUP_DIR),$$(grep ^BACKUP_DIR $(SIMPLE_ENV) | cut -d= -f2 | tr -d ' ' || echo ./backups))"; \
	FILE="$$BACKUP_DIR/backup-$(DATE).sql.gz"; \
	if [ ! -f "$$FILE" ]; then echo "[simple-restore] 备份文件不存在: $$FILE"; exit 1; fi; \
	echo "[simple-restore] 从 $$FILE 恢复 (将覆盖当前数据) ..."; \
	echo "[simple-restore] 5 秒后开始, Ctrl+C 取消 ..."; sleep 5; \
	docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) stop app; \
	gunzip -c $$FILE | docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) exec -T postgres \
		psql -U "$$(grep ^POSTGRES_USER $(SIMPLE_ENV) | cut -d= -f2 | tr -d ' ')" \
			 "$$(grep ^POSTGRES_DB $(SIMPLE_ENV) | cut -d= -f2 | tr -d ' ')"; \
	docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) start app

simple-upgrade:
	@if [ -z "$(TAG)" ]; then echo "用法: make simple-upgrade TAG=0.2.0"; exit 1; fi
	@echo "[simple-upgrade] 切换 DOCKER_TAG=$(TAG) ..."
	@sed -i.bak -E 's/^DOCKER_TAG=.*/DOCKER_TAG=$(TAG)/' $(SIMPLE_ENV) && rm $(SIMPLE_ENV).bak
	@docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) pull
	@docker compose -f $(SIMPLE_COMPOSE) --env-file $(SIMPLE_ENV) up -d
	@echo "[simple-upgrade] 完成。entrypoint 会自动跑新版本迁移。"
