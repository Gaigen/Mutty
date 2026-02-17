.PHONY: help build up down logs restart clean dev dev-down

help: ## Показать эту справку
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Собрать все Docker образы
	docker-compose build

up: ## Запустить все сервисы
	docker-compose up -d

down: ## Остановить все сервисы
	docker-compose down

logs: ## Показать логи всех сервисов
	docker-compose logs -f

restart: ## Перезапустить все сервисы
	docker-compose restart

clean: ## Остановить и удалить все контейнеры и volumes
	docker-compose down -v

dev: ## Запустить dev окружение (LiveKit + Token Server)
	docker-compose -f docker-compose.dev.yml up -d

dev-down: ## Остановить dev окружение
	docker-compose -f docker-compose.dev.yml down

dev-logs: ## Показать логи dev окружения
	docker-compose -f docker-compose.dev.yml logs -f

rebuild: ## Пересобрать и перезапустить
	docker-compose up -d --build

ps: ## Показать статус контейнеров
	docker-compose ps
