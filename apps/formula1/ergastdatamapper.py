import datetime
import os
import sys

import django
import ergast_py
from loguru import logger

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Base
from apps.formula1.models import Drivers, Constructors, Circuits, Seasons, Status

# Race
from apps.formula1.models import Races, Qualifying, Laptimes, Pitstops

# Results
from apps.formula1.models import Sprintresults


class ErgastDataMapper:
    """A class that maps Ergast API driver data to Driver model objects in the database."""

    def __init__(self):
        """Initialize an instance of the class and create an Ergast API client."""
        self.ergast_instance = ergast_py.Ergast()

    def update_drivers(self, season=datetime.datetime.now().year):
        """Fetch the latest driver data from the Ergast API and update the database with any new drivers."""
        drivers = self.ergast_instance.season(season).get_drivers()

        for driver in drivers:
            if not Drivers.objects.filter(driverref=driver.driver_id).exists():
                # If the driver doesn't already exist in the database, create a new Driver object
                _ = Drivers.objects.create(
                        driverref=driver.driver_id,
                        url=driver.url,
                        code=driver.code,
                        dob=driver.date_of_birth,
                        forename=driver.given_name,
                        surname=driver.family_name,
                        nationality=driver.nationality,
                        number=driver.permanent_number
                )
            logger.info(f"D: S{season} - D: {driver.code} - N: {driver.nationality}")

    def update_constructors(self, season=datetime.datetime.now().year):
        """Fetch the latest constructor data from the Ergast API and update the database with any new constructors."""
        constructors = self.ergast_instance.season(season).get_constructors()

        for constructor in constructors:
            if not Constructors.objects.filter(constructorref=constructor.constructor_id).exists():
                # If the constructor doesn't already exist in the database, create a new Constructors object
                _ = Constructors.objects.create(
                        constructorref=constructor.constructor_id,
                        name=constructor.name,
                        nationality=constructor.nationality,
                        url=constructor.url
                )
            logger.info(f"CON: S{season} - CON: {constructor.name} - N: {constructor.nationality}")

    def update_circuits(self, season=datetime.datetime.now().year):
        """Fetch the latest circuit data from the Ergast API and update the database with any new circuits."""
        circuits = self.ergast_instance.season(season).get_circuits()

        for circuit in circuits:
            if not Circuits.objects.filter(circuitref=circuit.circuit_id).exists():
                # If the circuit doesn't already exist in the database, create a new Circuits object
                _ = Circuits.objects.create(
                        circuitref=circuit.circuit_id,
                        name=circuit.circuit_name,
                        location=circuit.location.locality,
                        country=circuit.location.country,
                        lat=circuit.location.latitude,
                        lng=circuit.location.longitude,
                        url=circuit.url
                )
            logger.info(f"C: S{season} - C: {circuit.circuit_id} - N: {circuit.location.country}")

    def update_seasons(self):
        """Fetch the latest season data from the Ergast API and update the database with any new seasons."""
        seasons = self.ergast_instance.limit(1000).get_seasons()

        for season in seasons:
            if not Seasons.objects.filter(year=season.season).exists():
                # If the season doesn't already exist in the database, create a new Seasons object
                _ = Seasons.objects.create(
                        year=season.season,
                        url=season.url
                )
        logger.info(f"Seasons: Updating!")

    def update_status(self):
        """Fetch the latest season data from the Ergast API and update the database with any new status."""
        status = self.ergast_instance.limit(1000).get_statuses()

        for stat in status:
            if not Status.objects.filter(status=stat.status).exists():
                # If the status doesn't already exist in the database, create a new Status object
                _ = Status.objects.create(
                        status=stat.status,
                        statusid=stat.status_id
                )

        logger.info(f"Status: Updating!")

    def update_races(self, season=datetime.datetime.now().year):
        """Fetch the latest races data from the Ergast API and update the database with any new race."""
        races = self.ergast_instance.season(season).get_races()

        for race in races:
            if not Races.objects.filter(name=race.race_name, round=race.round_no, date=race.date.date()).exists():
                # If the race doesn't already exist in the database, create a new Races object
                _ = Races.objects.create(
                        year=Seasons.objects.get(year=race.date.year),
                        round=race.round_no,
                        circuitid=Circuits.objects.get(circuitref=race.circuit.circuit_id),
                        name=race.race_name,
                        date=race.date.date(),
                        time=race.date.time(),
                        url=race.url,
                        fp1_date=race.first_practice.date() if race.first_practice else None,
                        fp1_time=race.first_practice.time() if race.first_practice else None,
                        fp2_date=race.second_practice.date() if race.second_practice else None,
                        fp2_time=race.second_practice.time() if race.second_practice else None,
                        fp3_date=race.third_practice.date() if race.third_practice else None,
                        fp3_time=race.third_practice.time() if race.third_practice else None,
                        quali_date=race.qualifying.date() if race.qualifying else None,
                        quali_time=race.qualifying.time() if race.qualifying else None,
                        sprint_date=race.sprint.date() if race.sprint else None,
                        sprint_time=race.sprint.time() if race.sprint else None,
                )
            logger.info(f"R: S{season} - R{race.round_no} - C: {race.race_name}")

    def update_qualifying(self, season=datetime.datetime.now().year):
        """Fetch the latest qualifying data from the Ergast API and update the database with any new qualifying."""
        qualifyings = self.ergast_instance.season(season).limit(sys.maxsize).get_qualifyings()
        for race in qualifyings:
            for qualifyingresult in race.qualifying_results:
                if not Qualifying.objects.filter(raceid__name=race.race_name,
                                                 raceid__round=race.round_no,
                                                 raceid__date=race.date.date(),
                                                 raceid__circuitid__circuitref=race.circuit.circuit_id,
                                                 driverid__driverref=qualifyingresult.driver.driver_id,
                                                 constructorid__constructorref=qualifyingresult.constructor.constructor_id).exists():
                    # If the qualifying doesn't already exist in the database, create a new Qualifyings object
                    _ = Qualifying.objects.create(
                            raceid=Races.objects.get(name=race.race_name,
                                                     round=race.round_no,
                                                     date=race.date.date()),
                            driverid=Drivers.objects.get(driverref=qualifyingresult.driver.driver_id),
                            constructorid=Constructors.objects.get(
                                    constructorref=qualifyingresult.constructor.constructor_id),
                            number=qualifyingresult.number,
                            position=qualifyingresult.position,
                            q1=qualifyingresult.qual_1 if qualifyingresult.qual_1 else None,
                            q2=qualifyingresult.qual_2 if qualifyingresult.qual_2 else None,
                            q3=qualifyingresult.qual_3 if qualifyingresult.qual_3 else None
                    )
            logger.info(f"Q: S{season} - R{race.round_no} - C: {race.race_name}")

    def update_laptimes(self, season=datetime.datetime.now().year):
        """Fetch the latest laptimes data from the Ergast API and update the database with any new laptimes."""
        races = len(self.ergast_instance.season(season).get_races()) + 1
        for round_iter in range(1, races):
            laptimes = self.ergast_instance.season(season).round(round_iter).limit(sys.maxsize).get_laps()
            for race in laptimes:
                for laps in race.laps:
                    for timing in laps.timings:
                        timetomili = int((float(timing.time.minute) * 60 + float(timing.time.second) * 1000) + (
                                timing.time.microsecond / 1000))

                        if not Laptimes.objects.filter(raceid__name=race.race_name,
                                                       raceid__date=race.date.date(),
                                                       driverid__driverref=timing.driver_id,
                                                       lap=laps.number).exists():

                            _ = Laptimes.objects.create(
                                    raceid=Races.objects.get(name=race.race_name,
                                                             round=race.round_no,
                                                             date=race.date.date()),
                                    driverid=Drivers.objects.get(driverref=timing.driver_id),
                                    lap=laps.number,
                                    position=timing.position,
                                    time=timing.time,
                                    milliseconds=timetomili)

            logger.info(f"LT: S{season} - R{round_iter}")

    def update_pitstops(self, season=datetime.datetime.now().year):
        """Fetch the latest pitstops data from the Ergast API and update the database with any new pitstops."""
        races = len(self.ergast_instance.season(season).get_races()) + 1
        for round_iter in range(1, races):
            pitstops = self.ergast_instance.season(season).round(round_iter).limit(sys.maxsize).get_pit_stops()
            for race in pitstops:
                for pitstop in race.pit_stops:
                    timetomili = int((float(pitstop.duration.minute) * 60 + float(pitstop.duration.second) * 1000) + (
                            pitstop.duration.microsecond / 1000))

                    if not Pitstops.objects.filter(raceid__name=race.race_name,
                                                   raceid__date=race.date.date(),
                                                   driverid__driverref=pitstop.driver_id,
                                                   stop=pitstop.stop).exists():

                        _ = Pitstops.objects.create(
                                raceid=Races.objects.get(name=race.race_name,
                                                         round=race.round_no,
                                                         date=race.date.date()),
                                driverid=Drivers.objects.get(driverref=pitstop.driver_id),
                                lap=pitstop.lap,
                                stop=pitstop.stop,
                                time=pitstop.local_time,
                                duration=pitstop.duration,
                                milliseconds=timetomili)

            logger.info(f"PS: S{season} - R{round_iter}")

    def update_sprintresults(self, season=datetime.datetime.now().year):
        sprintresults = self.ergast_instance.season(season).limit(sys.maxsize).get_sprints()
        for race in sprintresults:
            for sprintresult in race.sprint_results:
                timetomili = int((float(sprintresult.time.minute) * 60 + float(sprintresult.time.second) * 1000) + (
                        sprintresult.time.microsecond / 1000)) if sprintresult.time else None
                if not Sprintresults.objects.filter(raceid__name=race.race_name,
                                                    raceid__round=race.round_no,
                                                    raceid__date=race.date.date(),
                                                    raceid__circuitid__circuitref=race.circuit.circuit_id,
                                                    driverid__driverref=sprintresult.driver.driver_id,
                                                    constructorid__constructorref=sprintresult.constructor.constructor_id).exists():

                    _ = Sprintresults.objects.create(raceid=Races.objects.get(name=race.race_name,
                                                                              round=race.round_no,
                                                                              date=race.date.date()),
                                                     driverid=Drivers.objects.get(
                                                             driverref=sprintresult.driver.driver_id),
                                                     constructorid=Constructors.objects.get(
                                                             constructorref=sprintresult.constructor.constructor_id),
                                                     statusid=Status.objects.get(statusid=sprintresult.status),
                                                     number=sprintresult.number,
                                                     grid=sprintresult.grid,
                                                     position=sprintresult.position,
                                                     positiontext=sprintresult.position_text,
                                                     positionorder=sprintresult.position,
                                                     points=sprintresult.points,
                                                     laps=sprintresult.laps,
                                                     time=sprintresult.time,
                                                     milliseconds=timetomili,
                                                     fastestlap=sprintresult.fastest_lap.lap,
                                                     fastestlaptime=sprintresult.fastest_lap.time)
            logger.info(f"SPRES: S{season} - R{race.round_no}")

    def update_constructorresults_driverresults(self, season=datetime.datetime.now().year):
        # TODO: update_constructorresults_driverresults
        constructorresults = self.ergast_instance.season(season).get_results()
        print(constructorresults)

    def update_constructorstandings(self, season=datetime.datetime.now().year):
        # TODO: update_constructorstandings
        constructorstanding = self.ergast_instance.season(season).get_constructor_standings()


if __name__ == '__main__':
    e = ErgastDataMapper()
    # e.update_drivers(2022)
    # e.update_constructors(2022)
    # e.update_circuits(2022)
    # e.update_seasons()
    # e.update_status()
    # e.update_races(2022)
    # e.update_qualifying(2022)
    # e.update_laptimes(2022)
    # e.update_pitstops(2022)
    # for i in range(1950, 2024):
    #     e.update_sprintresults(i)
