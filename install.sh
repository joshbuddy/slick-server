#!/bin/bash

set -e
set -o pipefail

SLICK_BRANCH=${SLICK_BRANCH:-master}
NODE_VERSION=${NODE_VERSION:-4.3.1}
SLICK_INSTALL_HOME=${SLICK_INSTALL_HOME:-~/.slick-install}
LOG=$SLICK_INSTALL_HOME/install.log
NVM_DIR=$SLICK_INSTALL_HOME/nvm

err_report() {
  echo "ERROR INSTALLING!"
  echo "  on line $1, see $LOG for details"
  exit 1
}

darwin_install_git() {
  echo -n "Checking for gcc..."
  (
    set +e
    gcc --help >> /dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo
      echo "=> Please follow the prompts to install the command-line tools..."
    fi
    gcc --help >> /dev/null 2>&1
    until [ $? -eq 0 ]; do
      sleep 1
      gcc --help >> /dev/null 2>&1
    done
  )
  if [ $? -ne 0 ]; then err_report "$LINENO"; fi
  echo " done!"
}

detect_profile() {
  local DETECTED_PROFILE
  DETECTED_PROFILE=''
  local SHELLTYPE
  SHELLTYPE=$(basename "/$SHELL")

  if [ "$SHELLTYPE" = "bash" ]; then
    if [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    elif [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    fi
  elif [ "$SHELLTYPE" = "zsh" ]; then
    DETECTED_PROFILE="$HOME/.zshrc"
  fi

  if [ -z "$DETECTED_PROFILE" ]; then
    if [ -f "$PROFILE" ]; then
      DETECTED_PROFILE="$PROFILE"
    elif [ -f "$HOME/.profile" ]; then
      DETECTED_PROFILE="$HOME/.profile"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    elif [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.zshrc" ]; then
      DETECTED_PROFILE="$HOME/.zshrc"
    fi
  fi

  if [ ! -z "$DETECTED_PROFILE" ]; then
    echo "$DETECTED_PROFILE"
  fi
}

fetch_homebrew() {
  echo -n "Getting Homebrew ..."
  export PATH="$SLICK_INSTALL_HOME/homebrew/bin:$PATH"
  (
    if [ ! -e "$SLICK_INSTALL_HOME/homebrew" ]; then
        git clone https://github.com/Homebrew/homebrew.git "$SLICK_INSTALL_HOME/homebrew"
    fi
    brew install libtool autoconf automake pkg-config
  ) >> "$LOG" 2>&1
  if [ $? -ne 0 ]; then err_report "$LINENO"; fi
  echo " done!"
}

# print a banner at the top showing the current install configuration
print_install_start() {
  echo "Installing slick into $SLICK_INSTALL_HOME"
  echo "  >> using node version $NODE_VERSION"
  echo "  >> using branch $SLICK_BRANCH"
  echo
}

# creates directories & installs anything needed by the install
prepare() {
  mkdir -p "$HOME/.slick"
  mkdir -p "$SLICK_INSTALL_HOME"
  rm -f "$SLICK_INSTALL_HOME/install.log"

  local platform
  platform=$(uname)
  case "$platform" in
  Darwin)
    darwin_install_git
    fetch_homebrew
    local detected_profile
    detected_profile=$(detect_profile)
    if [ -z "$detected_profile" ]; then
      touch ~/.bash_profile
    fi
  ;;
  *)
    echo "Unable to install on this platform... ${platform}, exiting"
    exit 1
  ;;
  esac
}

# installs a local copy of nvm
install_nvm() {
  # fetch nvm
  echo -n "Getting NVM ..."
  (
    if [ ! -e "$NVM_DIR" ]; then
      git clone https://github.com/creationix/nvm.git "$NVM_DIR"
    fi
  ) >> "$LOG" 2>&1
  if [ $? -ne 0 ]; then err_report "$LINENO"; fi
  echo " done!"
}

# updates the slick source and resets the branch
update_source() {
  # fetch slick
  echo -n "Getting Slick ..."
  (
    if [ ! -L "$SLICK_INSTALL_HOME/slick" ]; then
      rm -rf "$SLICK_INSTALL_HOME/slick"
      git clone https://github.com/joshbuddy/slick-server.git "$SLICK_INSTALL_HOME/git"
    fi
    cd "$SLICK_INSTALL_HOME/git"
    git fetch origin
    git reset --hard "origin/$SLICK_BRANCH"
    ln -sf "$SLICK_INSTALL_HOME/git" "$SLICK_INSTALL_HOME/slick"
  ) >> "$LOG" 2>&1
  if [ $? -ne 0 ]; then err_report "$LINENO"; fi
  echo " done!"
}

# installs a local copy of nodejs
install_node() {
  echo -n "Getting nodejs ..."
  (
    set +e
    . "$NVM_DIR/nvm.sh"
    nvm install "v$NODE_VERSION"
  ) >> "$LOG" 2>&1
  if [ $? -ne 0 ]; then err_report "$LINENO"; fi
  if [ ! -e "$NVM_DIR/versions/node/v$NODE_VERSION/bin/node" ]; then err_report "$LINENO"; fi
  export PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH"
  echo " done!"
}

# install slick's dependencies using npm
install_dependencies() {
  # npm install
  echo -n "Getting dependencies ..."
  (
    cd "$SLICK_INSTALL_HOME/slick"
    echo "cache = $SLICK_INSTALL_HOME/npm-cache" > "$SLICK_INSTALL_HOME/slick/.npmrc"
    npm install
  ) >> "$LOG" 2>&1
  if [ $? -ne 0 ]; then err_report "$LINENO"; fi
  echo " done!"
}

# re-writes shbangs of slick bins
rewrite_bins() {
  node_bin=$(which node)
  sed -i '' "s|/usr/bin/env node|${node_bin}|g" "$SLICK_INSTALL_HOME"/slick/bin/*
}

# checks profile and prints exit banner
post_install() {
  set +e

  sed -i '' "s|\$SLICK_INSTALL_HOME|${SLICK_INSTALL_HOME}|g" "$SLICK_INSTALL_HOME/slick/slick-server.plist"
  sed -i '' "s|\$SLICK_ROOT|${HOME}/.slick|g" "$SLICK_INSTALL_HOME/slick/slick-server.plist"
  sed -i '' "s|\$USER|${USER}|g" "$SLICK_INSTALL_HOME/slick/slick-server.plist"

  cp "$SLICK_INSTALL_HOME/slick/slick-server.plist" "$HOME/.slick/slick-server.plist"

  if [ ! -d $HOME/Library/LaunchAgents ]; then
    rm -rf $HOME/Library/LaunchAgents
    mkdir $HOME/Library/LaunchAgents
  fi

  if [ ! -L "$HOME/Library/LaunchAgents/slick-server.plist" ]; then
    ln -sfv "$HOME/.slick/slick-server.plist" "$HOME/Library/LaunchAgents"
    launchctl load "$HOME/Library/LaunchAgents/slick-server.plist"
  fi
  echo
  echo -n "Checking if $SLICK_INSTALL_HOME/slick/bin is in \$PATH ..."
  slick_path=$(which slick)
  if ! command which slick; then
    SLICK_PROFILE=$(detect_profile)
    SRC_STRING="\nexport PATH=\"\$PATH:$SLICK_INSTALL_HOME/slick/bin\"\n"

    if ! command grep -qF "$SLICK_INSTALL_HOME" "$SLICK_PROFILE"; then
      echo
      echo "=> Appending source string to $SLICK_PROFILE"
      echo "$(tput bold)=> Restart your terminal after installation completes"
      echo "=> Or source your $SLICK_PROFILE file$(tput sgr0)"
      echo -e "$SRC_STRING" >> "$SLICK_PROFILE"
    fi
  elif [ "$slick_path" != "$SLICK_INSTALL_HOME/slick/bin/slick" ]; then
    echo
    echo "=> Slick binary is currently $slick_path, which is not the version that was just installed."
    echo "=> If you want to use the version you just installed, add the following to your path:"
    echo "     $SLICK_INSTALL_HOME/slick/bin"
  fi

  if [ $? != 0 ]
  then
    echo "Couldn't successfully add Slick to your path, exiting."
    exit 1
  fi

  echo " done!"
  echo
  echo "Done installing Slick, have fun!"
  echo
  echo "=> Please visit https://docs.slick.io for more documentation, or run slick help"

  if [ ! -e "$HOME/.slick/config.json" ]; then
    echo
    echo "No directory detected at $HOME/.slick, running slick config to complete setup..."
    exec bash -i -c "$NVM_DIR/versions/node/v$NODE_VERSION/bin/node $SLICK_INSTALL_HOME/slick/bin/slick-config"
  fi
}

trap 'err_report "$LINENO"' ERR

print_install_start

prepare
install_nvm
update_source
install_node
install_dependencies
rewrite_bins
post_install
