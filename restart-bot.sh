#!/bin/bash

# Restart script for TON Notification Bot
# This script will restart the bot if it crashes

LOG_FILE="restart.log"
MAX_RESTARTS=10
RESTART_DELAY=5

echo "$(date): Starting TON Notification Bot restart script" >> $LOG_FILE

restart_count=0

while [ $restart_count -lt $MAX_RESTARTS ]
do
  echo "$(date): Starting bot (attempt $((restart_count+1)))" >> $LOG_FILE
  
  # Start the bot
  node ton-notification-bot.js
  
  # If we get here, the bot has crashed
  exit_code=$?
  restart_count=$((restart_count+1))
  
  echo "$(date): Bot exited with code $exit_code. Restarting in $RESTART_DELAY seconds..." >> $LOG_FILE
  sleep $RESTART_DELAY
  
  # Increase delay for each restart to avoid rapid restarts
  RESTART_DELAY=$((RESTART_DELAY+5))
done

echo "$(date): Maximum restart attempts ($MAX_RESTARTS) reached. Giving up." >> $LOG_FILE