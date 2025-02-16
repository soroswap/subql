FROM rust:latest

# Instalar soroban-cli
RUN cargo install --locked soroban-cli

WORKDIR /workspace
