#!/bin/bash

# Start MongoDB
echo "Starting MongoDB..."
mongod --dbpath ./data/mongodb &
MONGO_PID=$!
sleep 2

# Initialize database
echo "Initializing database..."
python backend/scripts/init_db.py

# Start backend
echo "Starting backend..."
cd backend
python main.py &
BACKEND_PID=$!
sleep 3

# Start frontend
echo "Starting frontend..."
cd ..
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "VoIP System Started"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for interrupt
trap "kill $MONGO_PID $BACKEND_PID $FRONTEND_PID" INT
wait
