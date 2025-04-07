
#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
  source venv/bin/activate
fi

# Start FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
