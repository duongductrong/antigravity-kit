#!/bin/bash

# Open Antigravity with custom user-data-dir
# Usage: ./open-antigravity.sh <profile_path>

PROFILE_PATH="$1"

if [ -z "$PROFILE_PATH" ]; then
    echo "Usage: open-antigravity.sh <profile_path>" >&2
    exit 1
fi

# Expand ~ to home directory if present
PROFILE_PATH="${PROFILE_PATH/#\~/$HOME}"

open_antigravity() {
    case "$(uname -s)" in
        Darwin)
            # macOS
            if [ -d "/Applications/Antigravity.app" ]; then
                open -a "Antigravity" --args --user-data-dir="$PROFILE_PATH"
            elif [ -d "$HOME/Applications/Antigravity.app" ]; then
                open -a "$HOME/Applications/Antigravity.app" --args --user-data-dir="$PROFILE_PATH"
            else
                echo "Error: Antigravity.app not found in /Applications or ~/Applications" >&2
                exit 1
            fi
            ;;
        Linux)
            # Linux - try common installation paths
            if command -v antigravity &>/dev/null; then
                antigravity --user-data-dir="$PROFILE_PATH" &
            elif [ -x "/usr/bin/antigravity" ]; then
                /usr/bin/antigravity --user-data-dir="$PROFILE_PATH" &
            elif [ -x "/usr/local/bin/antigravity" ]; then
                /usr/local/bin/antigravity --user-data-dir="$PROFILE_PATH" &
            else
                echo "Error: antigravity command not found" >&2
                exit 1
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            # Windows (Git Bash / MSYS / Cygwin)
            if [ -x "/c/Program Files/Antigravity/antigravity.exe" ]; then
                "/c/Program Files/Antigravity/antigravity.exe" --user-data-dir="$PROFILE_PATH" &
            elif [ -x "$LOCALAPPDATA/Programs/Antigravity/antigravity.exe" ]; then
                "$LOCALAPPDATA/Programs/Antigravity/antigravity.exe" --user-data-dir="$PROFILE_PATH" &
            else
                echo "Error: antigravity.exe not found" >&2
                exit 1
            fi
            ;;
        *)
            echo "Unsupported operating system: $(uname -s)" >&2
            exit 1
            ;;
    esac
}

open_antigravity

