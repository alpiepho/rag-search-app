#!/bin/bash

# Generate PDF files from man pages for top Linux commands
# Usage: bash generate_linux_pdfs.sh

# Create samples directory if it doesn't exist
mkdir -p "$(dirname "$0")"

# Top 100 Linux commands
commands=(
  # File and directory operations
  ls cat cp mv rm mkdir rmdir pwd cd touch ln chmod chown stat file find locate
  
  # Text processing
  grep sed awk cut paste sort uniq wc head tail less more cat rev tr
  
  # System information
  uname whoami id groups sudo su df du ps top htop free memory lsblk mount umount
  
  # Process management
  kill pkill jobs bg fg wait nohup nice renice
  
  # Network tools
  ping ssh scp sftp netstat ss nc curl wget telnet dig nslookup ifconfig ip route arp
  
  # File compression
  tar gzip gunzip bzip2 zip unzip xz
  
  # Text editors and viewers
  nano vim vi emacs less more
  
  # Development tools
  git gcc make cmake python node npm gcc g++ java javac
  
  # User and permission management
  useradd userdel usermod groupadd groupdel passwd visudo su sudo
  
  # System administration
  systemctl service crontab at shutdown reboot halt poweroff timedatectl
  
  # Search and filtering
  find xargs grep egrep fgrep
  
  # Archive operations
  tar zip unzip bzip2 gzip
  
  # Other useful commands
  echo printf date cal history bash sh zsh clear reset man info whatis whereis which command type alias unalias export printenv env
)

# Counter for progress
count=0
total=${#commands[@]}
successful=0
failed=0

echo "Generating PDF files from man pages for Linux commands..."
echo "Total commands to process: $total"
echo ""

for cmd in "${commands[@]}"; do
  ((count++))
  printf "[$count/$total] Processing '$cmd'... "
  
  # Check if man page exists
  if man "$cmd" &>/dev/null; then
    # Generate PDF
    if man -t "$cmd" 2>/dev/null | ps2pdf - "${cmd}.pdf" 2>/dev/null; then
      echo "✓ Created ${cmd}.pdf"
      ((successful++))
    else
      echo "✗ Failed to convert to PDF"
      ((failed++))
    fi
  else
    echo "✗ No man page found"
    ((failed++))
  fi
done

echo ""
echo "=========================================="
echo "Summary:"
echo "Total commands: $total"
echo "Successful PDFs: $successful"
echo "Failed: $failed"
echo "=========================================="
echo ""
echo "PDF files saved in: $(pwd)"
ls -lh *.pdf 2>/dev/null | wc -l | xargs echo "Total PDF files created:"
