# Airline Ticketing System (Group 1)

This project simulates a Microservices-based Airline Ticketing System using **Node.js**, **Python**, **RabbitMQ**, **Redis**, and **PostgreSQL**.

## Prerequisites
- **Docker Desktop** installed and running.

## How to Run
1. Open a terminal in this folder.
2. Run the following command:
   ```bash
   docker-compose up --build
   ```
3. Wait for all services to start.

## Accessing the Application
- **UI (Client)**: http://localhost:8080
- **API Gateway**: http://localhost:3000

## Architecture Overview
- **Gateway**: Node.js (Express) - Port 3000
- **Flight Service**: Node.js, Postgres - Port 3001
- **Search Service**: Node.js, Redis - Port 3002
- **Notification**: Node.js, RabbitMQ - Port 3003
- **ML Service**: Python (Flask) - Port 5000
- **Client**: HTML/JS (Nginx) - Port 8080
