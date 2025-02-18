#!/bin/bash

# Function to connect to node-subql-app container
connect_to_container() {
  echo "Connecting to node-subql-app container..."
  docker exec --tty --interactive node-subql-app bash
}

if [[ $# -eq 0 ]]; then
  # No arguments, connect to node-subql-app
  connect_to_container
elif [[ $1 == "--no-blockchain" || $1 == "--nb" ]]; then
  # With --no-blockchain, start only node-subql-app container and connect
  echo "Starting only node-subql-app container..."
  docker-compose up -d node-subql-app
  connect_to_container
else
  # Any other argument, just connect to node-subql-app
  connect_to_container
fi
