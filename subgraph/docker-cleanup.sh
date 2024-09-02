#!/bin/env bash

echo -n "Are you sure you want to remove all containers and volumes? [y/N] "
read -r response

if [[ ! "$response" =~ ^[yY]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Stopping and removing containers..."
docker compose rm -fsv

echo ""
echo "Removing volumes..."
docker volume rm subgraph_ipfs
docker volume rm subgraph_postgres

echo ""
echo "Done."
