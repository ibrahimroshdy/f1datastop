
# F1 Data Backend

This backend service provides F1 data using the FastF1 Python library through a FastAPI REST API.

## Getting Started

### Prerequisites

- Python 3.8+
- Virtual environment (recommended)

### Installation

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install the requirements:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload
```

The API will be available at http://localhost:8000

### API Documentation

Once the server is running, you can access the Swagger UI documentation at:

http://localhost:8000/docs

## Available Endpoints

- GET `/api/seasons` - Get available F1 seasons
- GET `/api/schedule/{year}` - Get race schedule for a specific year
- GET `/api/driver-standings/{year}` - Get driver standings for a specific year
- GET `/api/constructor-standings/{year}` - Get constructor standings for a specific year
- GET `/api/results/{year}/{round}` - Get race results for a specific race
- GET `/api/qualifying/{year}/{round}` - Get qualifying results for a specific race
- GET `/api/lap-times/{year}/{round}` - Get lap times for a specific race
- GET `/api/last-race-results` - Get results from the last completed race
- GET `/api/next-race` - Get information about the next race
