# littleguys: everyday commands. Run `make` to list them.

.DEFAULT_GOAL := help
.PHONY: help install run mock build install-app check test clean

APP := src-tauri/target/release/bundle/macos/littleguys.app

help: ## List the commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-12s %s\n", $$1, $$2}'

install: ## Install dependencies (needs Node 22+, pnpm and Rust)
	@command -v pnpm >/dev/null || { echo "pnpm not found: run 'corepack enable' or 'npm i -g pnpm'"; exit 1; }
	@command -v cargo >/dev/null || { echo "Rust not found: install it from https://rustup.rs"; exit 1; }
	pnpm install
	cd src-tauri && cargo fetch

run: ## Run the app, with a hot-reloading UI
	pnpm tauri dev

mock: ## Run only the UI in a browser, against a mock gateway
	@echo "Open http://localhost:1420/main.html"
	pnpm dev

build: ## Build littleguys.app
	pnpm tauri build

install-app: build ## Build littleguys.app and put it in /Applications
	rm -rf /Applications/littleguys.app
	cp -R $(APP) /Applications/
	@echo "Installed /Applications/littleguys.app"

check: ## Typecheck the UI and the Rust core
	pnpm typecheck
	cd src-tauri && cargo check

test: ## Run the Rust tests
	cd src-tauri && cargo test

clean: ## Remove build output
	rm -rf dist
	cd src-tauri && cargo clean
