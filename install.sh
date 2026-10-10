#!/usr/bin/env bash
# Builds littleguys from source and installs it in /Applications:
#
#   curl -fsSL https://raw.githubusercontent.com/herval/littleguys/main/install.sh | bash
#
# It installs whatever's missing first: the Xcode Command Line Tools, Rust (via rustup)
# and, when there's no Node 22+ or pnpm on the PATH, a private copy of each under
# ~/.littleguys. Nothing is added to your shell profile and nothing needs sudo.
# Run it again to update. Run from a clone (./install.sh), it builds that clone.
#
#   LITTLEGUYS_HOME  where the checkout and private tools live (default ~/.littleguys)
#   LITTLEGUYS_REF   branch or tag to build (default main)

set -euo pipefail

REPO="https://github.com/herval/littleguys.git"
LG_HOME="${LITTLEGUYS_HOME:-$HOME/.littleguys}"
REF="${LITTLEGUYS_REF:-main}"
NODE_LINE=24 # Node release line to fetch when there's no Node 22+
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 # a corepack pnpm shim would otherwise ask before downloading
export npm_config_update_notifier=false   # and pnpm would nag about its own updates

if [ -t 1 ]; then B=$'\033[1m' P=$'\033[1;35m' R=$'\033[1;31m' X=$'\033[0m'; else B="" P="" R="" X=""; fi
say() { printf '%s==>%s %s%s%s\n' "$P" "$X" "$B" "$*" "$X"; }
note() { printf '    %s\n' "$*"; }
die() { printf '%serror:%s %s\n' "$R" "$X" "$*" >&2; exit 1; }

check_mac() {
  [ "$(uname -s)" = Darwin ] || die "littleguys is a macOS app."
  local major
  major="$(sw_vers -productVersion | cut -d. -f1)"
  [ "$major" -ge 13 ] || die "littleguys needs macOS 13 or later (this Mac runs $(sw_vers -productVersion))."
}

check_disk() {
  local free_gb
  free_gb=$(($(df -k "$HOME" | awk 'NR==2 {print $4}') / 1024 / 1024))
  [ "$free_gb" -ge 5 ] || note "Heads up: only ${free_gb} GB free, and the build needs about 4 GB."
}

# git, make and the C toolchain Rust links with all come with the Command Line Tools.
ensure_clt() {
  xcode-select -p >/dev/null 2>&1 && return
  say "Installing the Xcode Command Line Tools"
  note "Click Install in the dialog that just opened. This waits until it's done."
  xcode-select --install >/dev/null 2>&1 || true
  until xcode-select -p >/dev/null 2>&1; do sleep 5; done
}

# The universal build cross-compiles for Intel and Apple silicon, so it needs rustup
# (Homebrew's rust can't add targets). The build uses stable, whatever your default is.
ensure_rust() {
  # shellcheck disable=SC1091
  [ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
  if ! command -v rustup >/dev/null; then
    say "Installing Rust"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs |
      RUSTUP_INIT_SKIP_PATH_CHECK=yes sh -s -- -y --no-modify-path --profile minimal --default-toolchain stable
    # shellcheck disable=SC1091
    . "$HOME/.cargo/env"
  else
    say "Checking Rust stable"
    rustup toolchain install stable --profile minimal
  fi
  export RUSTUP_TOOLCHAIN=stable
}

node_ok() {
  command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]
}

ensure_node() {
  [ -x "$LG_HOME/node/bin/node" ] && ! node_ok && export PATH="$LG_HOME/node/bin:$PATH"
  node_ok && return

  say "Fetching Node $NODE_LINE into $LG_HOME/node"
  local arch base line file tmp
  arch="$(uname -m)"
  [ "$arch" = x86_64 ] && arch=x64
  base="https://nodejs.org/dist/latest-v${NODE_LINE}.x"
  line="$(curl -fsSL "$base/SHASUMS256.txt" | grep -E "  node-v[0-9.]+-darwin-${arch}\.tar\.gz$")" ||
    die "Couldn't find a Node $NODE_LINE download for darwin-$arch."
  file="${line##* }"
  tmp="$(mktemp -d)"
  curl -fsSL "$base/$file" -o "$tmp/$file"
  (cd "$tmp" && printf '%s\n' "$line" | shasum -a 256 -c - >/dev/null) || die "The Node download didn't match its checksum."
  rm -rf "$LG_HOME/node"
  mkdir -p "$LG_HOME/node"
  tar -xzf "$tmp/$file" -C "$LG_HOME/node" --strip-components 1
  rm -rf "$tmp"
  export PATH="$LG_HOME/node/bin:$PATH"
}

pnpm_ok() {
  command -v pnpm >/dev/null && [ "$(pnpm --version | cut -d. -f1)" -ge 9 ]
}

ensure_pnpm() {
  [ -x "$LG_HOME/tools/bin/pnpm" ] && ! pnpm_ok && export PATH="$LG_HOME/tools/bin:$PATH"
  pnpm_ok && return
  say "Installing pnpm into $LG_HOME/tools"
  npm install --global --silent --prefix "$LG_HOME/tools" pnpm@11
  export PATH="$LG_HOME/tools/bin:$PATH"
}

# A clone the script runs from, or its own checkout in $LG_HOME/src (which it owns:
# local changes there are overwritten).
fetch_source() {
  local self="${BASH_SOURCE[0]:-}" # empty when piped from curl
  if [ -f "$self" ] && [ -f "$(dirname "$self")/src-tauri/tauri.conf.json" ]; then
    SRC="$(cd "$(dirname "$self")" && pwd)"
    say "Building the clone in $SRC"
    return
  fi
  SRC="$LG_HOME/src"
  if [ -d "$SRC/.git" ]; then
    say "Updating $SRC"
    git -C "$SRC" fetch --quiet --depth 1 origin "$REF"
    git -C "$SRC" checkout --quiet --force --detach FETCH_HEAD
  else
    say "Cloning littleguys into $SRC"
    git clone --quiet --depth 1 --branch "$REF" "$REPO" "$SRC"
  fi
}

main() {
  check_mac
  check_disk
  ensure_clt
  ensure_rust
  ensure_node
  ensure_pnpm
  fetch_source

  # Admins can write to /Applications; everyone else gets ~/Applications.
  local apps=/Applications
  [ -w "$apps" ] || { apps="$HOME/Applications" && mkdir -p "$apps"; }

  cd "$SRC"
  say "Fetching dependencies"
  make install
  say "Building littleguys.app"
  note "The first build compiles the whole Rust core, so give it a few minutes."
  make install-app APPS="$apps"

  open "$apps/littleguys.app"
  say "littleguys is in $apps. Look for the guy in your menu bar."
  note "To update, run the same command again."
}

main "$@"
