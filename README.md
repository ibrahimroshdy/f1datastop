
# F1 Dashboard

A Formula 1 dashboard application that uses the FastF1 Python library to display real-time race data, statistics, and visualizations.

## Project Structure

- `/src` - React frontend application
- `/backend` - Python FastAPI backend using FastF1 library

## Setup Instructions

### Python Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

4. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Start the FastAPI server:
   ```
   uvicorn main:app --reload
   ```

The backend should now be running on http://localhost:8000.

### React Frontend Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

The frontend application should now be running on http://localhost:5173 or another available port.

## Important Notes

- The backend must be running for the application to function properly
- The FastF1 library will cache data in a `cache` folder to avoid repeated downloads
- First-time requests may take longer as data is downloaded and cached

## Features

- Current driver and constructor standings
- Race results and race calendar
- Detailed timing information
- Lap time analysis
- Race visualizations

## Technology Stack

- **Frontend**: React, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: FastAPI, FastF1, Python
- **Data Visualization**: Recharts
