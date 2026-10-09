# littleguys: everyday commands. Run `make` to list them.

.DEFAULT_GOAL := help
.PHONY: help install run mock build release install-app check test clean

# One universal binary: runs on Apple silicon and Intel Macs.
TARGET := universal-apple-darwin
APP := src-tauri/target/$(TARGET)/release/bundle/macos/littleguys.app
UPDATER_KEY := $(HOME)/.tauri/littleguys-updater.key

help: ## List the commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-12s %s\n", $$1, $$2}'

install: ## Install dependencies (needs Node 22+, pnpm and Rust)
	@command -v pnpm >/dev/null || { echo "pnpm not found: run 'corepack enable' or 'npm i -g pnpm'"; exit 1; }
	@command -v cargo >/dev/null || { echo "Rust not found: install it from https://rustup.rs"; exit 1; }
	rustup target add aarch64-apple-darwin x86_64-apple-darwin
	pnpm install
	cd src-tauri && cargo fetch

run: ## Run the app, with a hot-reloading UI
	pnpm tauri dev

mock: ## Run only the UI in a browser, against a mock gateway
	@echo "Open http://localhost:1420/main.html"
	pnpm dev

build: ## Build littleguys.app and a .dmg (universal: Apple silicon + Intel)
	pnpm tauri build --target $(TARGET)

release: ## Same as build, plus the signed update bundle (.app.tar.gz + .sig) the updater installs
	@test -f $(UPDATER_KEY) || { echo "No updater key at $(UPDATER_KEY)"; exit 1; }
	TAURI_SIGNING_PRIVATE_KEY=$(UPDATER_KEY) TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$$(cat $(UPDATER_KEY).password)" \
		pnpm tauri build --target $(TARGET) --config src-tauri/tauri.release.conf.json

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
