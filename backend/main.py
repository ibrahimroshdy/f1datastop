
import fastapi
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import fastf1
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
import os
import logging
from datetime import datetime, timedelta
import json

# Configure FastF1 cache
fastf1.Cache.enable_cache('cache')

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="F1 Data API",
    description="API to provide Formula 1 data using FastF1 library",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions
def serialize_timedelta(obj):
    if isinstance(obj, timedelta):
        return str(obj)
    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    elif pd.isna(obj):
        return None
    else:
        return obj

def dataframe_to_dict(df):
    if df is None or df.empty:
        return []
    
    # Convert DataFrame to dict, handling pandas and numpy specific types
    result = df.replace({np.nan: None}).to_dict(orient='records')
    
    # Custom JSON serialization
    return json.loads(json.dumps(result, default=serialize_timedelta))

# API endpoints
@app.get("/")
async def root():
    return {"message": "F1 Data API is running"}

@app.get("/api/seasons")
async def get_seasons(limit: int = 5):
    """Get available F1 seasons"""
    try:
        # Get current year
        current_year = datetime.now().year
        # Return last 'limit' seasons including current
        seasons = list(range(current_year, current_year - limit, -1))
        return {"data": seasons}
    except Exception as e:
        logger.error(f"Error getting seasons: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/schedule/{year}")
async def get_schedule(year: int):
    """Get race schedule for a specific year"""
    try:
        schedule = fastf1.get_event_schedule(year)
        result = dataframe_to_dict(schedule)
        return {"data": result}
    except Exception as e:
        logger.error(f"Error getting schedule for {year}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/driver-standings/{year}")
async def get_driver_standings(year: int):
    """Get driver standings for a specific year"""
    try:
        # Get most recent event for the year
        schedule = fastf1.get_event_schedule(year)
        events = dataframe_to_dict(schedule)
        
        # Find the most recent completed event
        now = datetime.now()
        completed_events = [
            event for event in events 
            if datetime.fromisoformat(event['EventDate'].replace('Z', '+00:00')) < now
        ]
        
        if not completed_events:
            return {"data": [], "message": "No completed events found for this season"}
        
        latest_event = completed_events[-1]
        
        # Get driver standings
        session = fastf1.get_session(year, latest_event['EventName'], 'R')
        session.load()
        
        driver_standings = session.get_driver_standings()
        result = dataframe_to_dict(driver_standings)
        
        return {"data": result, "event": latest_event['EventName']}
    except Exception as e:
        logger.error(f"Error getting driver standings for {year}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/constructor-standings/{year}")
async def get_constructor_standings(year: int):
    """Get constructor standings for a specific year"""
    try:
        # Get most recent event for the year
        schedule = fastf1.get_event_schedule(year)
        events = dataframe_to_dict(schedule)
        
        # Find the most recent completed event
        now = datetime.now()
        completed_events = [
            event for event in events 
            if datetime.fromisoformat(event['EventDate'].replace('Z', '+00:00')) < now
        ]
        
        if not completed_events:
            return {"data": [], "message": "No completed events found for this season"}
        
        latest_event = completed_events[-1]
        
        # Get constructor standings
        session = fastf1.get_session(year, latest_event['EventName'], 'R')
        session.load()
        
        constructor_standings = session.get_constructor_standings()
        result = dataframe_to_dict(constructor_standings)
        
        return {"data": result, "event": latest_event['EventName']}
    except Exception as e:
        logger.error(f"Error getting constructor standings for {year}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/results/{year}/{round}")
async def get_race_results(year: int, round: str):
    """Get race results for a specific race"""
    try:
        # Get the race session
        session = fastf1.get_session(year, round, 'R')
        session.load()
        
        # Get results
        results = session.results
        result_data = dataframe_to_dict(results)
        
        # Add race name to the response
        event_data = {
            "raceName": session.event['EventName'],
            "date": session.event['EventDate'],
            "results": result_data
        }
        
        return {"data": event_data}
    except Exception as e:
        logger.error(f"Error getting race results for {year}/{round}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/qualifying/{year}/{round}")
async def get_qualifying_results(year: int, round: str):
    """Get qualifying results for a specific race"""
    try:
        # Get the qualifying session
        session = fastf1.get_session(year, round, 'Q')
        session.load()
        
        # Get qualifying results
        results = session.results
        result_data = dataframe_to_dict(results)
        
        # Add session info to the response
        qualifying_data = {
            "raceName": session.event['EventName'],
            "date": session.event['EventDate'],
            "qualifying": result_data
        }
        
        return {"data": qualifying_data}
    except Exception as e:
        logger.error(f"Error getting qualifying results for {year}/{round}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/lap-times/{year}/{round}")
async def get_lap_times(
    year: int, 
    round: str, 
    driver_filter: Optional[str] = Query(None, description="Filter by driver ID (comma-separated)")
):
    """Get lap times for a specific race"""
    try:
        # Get the race session
        session = fastf1.get_session(year, round, 'R')
        session.load()
        
        # Get lap data
        laps = session.laps
        
        # Filter by drivers if specified
        if driver_filter:
            driver_ids = [d.strip() for d in driver_filter.split(',')]
            laps = laps[laps['Driver'].isin(driver_ids)]
        
        # Convert to records
        laps_data = dataframe_to_dict(laps)
        
        # Nest by lap number for compatibility with current frontend
        structured_laps = []
        for lap_number in sorted(set([l.get('LapNumber') for l in laps_data if l.get('LapNumber')])):
            lap_drivers = [l for l in laps_data if l.get('LapNumber') == lap_number]
            
            timings = []
            for ld in lap_drivers:
                timings.append({
                    "driverId": ld.get('Driver'),
                    "position": ld.get('Position'),
                    "time": ld.get('LapTime'),
                    "gap": ld.get('LapTimeDelta')
                })
            
            structured_laps.append({
                "number": str(lap_number),
                "Timings": timings
            })
        
        response_data = {
            "Races": [{
                "raceName": session.event['EventName'],
                "date": session.event['EventDate'],
                "Laps": structured_laps
            }]
        }
        
        return {"data": response_data}
    except Exception as e:
        logger.error(f"Error getting lap times for {year}/{round}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/last-race-results")
async def get_last_race_results():
    """Get results from the last completed race"""
    try:
        # Get current year
        current_year = datetime.now().year
        
        # Get schedule for current year
        schedule = fastf1.get_event_schedule(current_year)
        events = dataframe_to_dict(schedule)
        
        # Find the most recent completed event
        now = datetime.now()
        completed_events = [
            event for event in events 
            if datetime.fromisoformat(event['EventDate'].replace('Z', '+00:00')) < now
        ]
        
        if not completed_events:
            return {"data": None, "message": "No completed events found for this season"}
        
        latest_event = completed_events[-1]
        
        # Get the race session
        session = fastf1.get_session(current_year, latest_event['EventName'], 'R')
        session.load()
        
        # Get results
        results = session.results
        result_data = dataframe_to_dict(results)
        
        # Format response to match frontend expectations
        response_data = {
            "raceName": session.event['EventName'],
            "results": result_data
        }
        
        return {"data": response_data}
    except Exception as e:
        logger.error(f"Error getting last race results: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/next-race")
async def get_next_race():
    """Get information about the next race"""
    try:
        # Get current year
        current_year = datetime.now().year
        
        # Get schedule for current year
        schedule = fastf1.get_event_schedule(current_year)
        events = dataframe_to_dict(schedule)
        
        # Find the next upcoming event
        now = datetime.now()
        upcoming_events = [
            event for event in events 
            if datetime.fromisoformat(event['EventDate'].replace('Z', '+00:00')) > now
        ]
        
        if not upcoming_events:
            return {"data": None, "message": "No upcoming events found for this season"}
        
        next_event = upcoming_events[0]
        
        # Add circuit information
        circuit_info = {
            "circuitId": next_event.get('CircuitShortName'),
            "circuitName": next_event.get('CircuitName'),
            "Location": {
                "locality": next_event.get('Location'),
                "country": next_event.get('Country')
            }
        }
        
        next_event['Circuit'] = circuit_info
        
        return {"data": next_event}
    except Exception as e:
        logger.error(f"Error getting next race: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
