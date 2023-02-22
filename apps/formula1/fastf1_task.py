
import os

import django
import ergast_py

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.formula1.models import Drivers, Constructors, Circuits, Seasons, Status, Races


class ErgastDataMapper:
    """A class that maps Ergast API driver data to Driver model objects in the database."""

    def __init__(self):
        """Initialize an instance of the class and create an Ergast API client."""
        self.ergast_instance = ergast_py.Ergast()

    def update_drivers(self):
        """Fetch the latest driver data from the Ergast API and update the database with any new drivers."""
        drivers = self.ergast_instance.season(2022).get_drivers()

        for driver in drivers:
            if not Drivers.objects.filter(driverref=driver.driver_id).exists():
                # If the driver doesn't already exist in the database, create a new Driver object
                db_instance = Drivers.objects.create(
                        driverref=driver.driver_id,
                        url=driver.url,
                        code=driver.code,
                        dob=driver.date_of_birth,
                        forename=driver.given_name,
                        surname=driver.family_name,
                        nationality=driver.nationality,
                        number=driver.permanent_number
                )
                print(f"Driver {db_instance.driverref} added to database.")
            else:
                # If the driver already exists in the database, log that fact and move on to the next driver
                print(f"Driver {driver.driver_id} already exists in database.")

    def update_constructors(self):
        """Fetch the latest constructor data from the Ergast API and update the database with any new constructors."""
        constructors = self.ergast_instance.season(2022).get_constructors()

        for constructor in constructors:
            if not Constructors.objects.filter(constructorref=constructor.constructor_id).exists():
                # If the constructor doesn't already exist in the database, create a new Constructors object
                db_instance = Constructors.objects.create(
                        constructorref=constructor.constructor_id,
                        name=constructor.name,
                        nationality=constructor.nationality,
                        url=constructor.url
                )
                print(f"Constructor {db_instance.constructorref} added to database.")
            else:
                # If the constructor already exists in the database, log that fact and move on to the next constructor
                print(f"Constructor {constructor.constructor_id} already exists in database.")

    def update_circuits(self):
        """Fetch the latest circuit data from the Ergast API and update the database with any new circuits."""
        circuits = self.ergast_instance.season(2022).get_circuits()

        for circuit in circuits:
            if not Circuits.objects.filter(circuitref=circuit.circuit_id).exists():
                # If the circuit doesn't already exist in the database, create a new Circuits object
                db_instance = Circuits.objects.create(
                        circuitref=circuit.circuit_id,
                        name=circuit.circuit_name,
                        location=circuit.location.locality,
                        country=circuit.location.country,
                        lat=circuit.location.latitude,
                        lng=circuit.location.longitude,
                        url=circuit.url
                )
                print(f"Circuit {db_instance.circuitref} added to database.")
            else:
                # If the circuit already exists in the database, log that fact and move on to the next circuit
                print(f"Circuit {circuit.circuit_id} already exists in database.")

    def update_seasons(self):
        """Fetch the latest season data from the Ergast API and update the database with any new seasons."""
        seasons = self.ergast_instance.limit(1000).get_seasons()

        for season in seasons:
            if not Seasons.objects.filter(year=season.season).exists():
                # If the season doesn't already exist in the database, create a new Seasons object
                db_instance = Seasons.objects.create(
                        year=season.season,
                        url=season.url
                )
                print(f"season {db_instance.year} added to database.")
            else:
                # If the season already exists in the database, log that fact and move on to the next season
                print(f"season {season.season} already exists in database.")

    def update_status(self):
        """Fetch the latest season data from the Ergast API and update the database with any new status."""
        status = self.ergast_instance.limit(1000).get_statuses()

        for stat in status:
            if not Status.objects.filter(status=stat.status).exists():
                # If the status doesn't already exist in the database, create a new Status object
                db_instance = Status.objects.create(
                        status=stat.status,
                        statusid=stat.status_id
                )
                print(f"Status {db_instance.status} added to database.")
            else:
                # If the status already exists in the database, log that fact and move on to the next status
                print(f"Status {stat.status} already exists in database.")

    def update_races(self):
        races = e.ergast_instance.season(2022).get_races()

        for race in races:
            if not Races.objects.filter(name=race.race_name, round=race.round_no, date=race.date.date()):
                # If the raace doesn't already exist in the database, create a new Races object
                db_instance = Races.objects.create(
                        year=race.season,
                        round=race.round_no,
                        circuitid=Circuits.objects.get(circuitref=race.circuit.circuit_id),
                        name=race.race_name,
                        date=race.date.date(),
                        time=race.date.time(),
                        url=race.url,
                        fp1_date=race.first_practice.date(),
                        fp1_time=race.first_practice.time(),
                        fp2_date=race.second_practice.date(),
                        fp2_time=race.second_practice.time(),
                        fp3_date=race.third_practice.date(),
                        fp3_time=race.third_practice.time(),
                        quali_date=race.qualifying.date() if race.qualifying else None,
                        quali_time=race.qualifying.time() if race.qualifying else None,
                        sprint_date=race.sprint.date() if race.sprint else None,
                        sprint_time=race.sprint.time() if race.sprint else None,
                )
                print(f"Race {db_instance.name}-{db_instance.round}-{db_instance.year} added to database.")
            else:
                # If the status already exists in the database, log that fact and move on to the next status
                print(f"Race {race.race_name}-{race.round_no}-{race.season} already exists in database.")


#
# constructors = e.season(2022).get_constructors()
# # for constructor in constructors:
# #     db_constructor = Constructors.objects.get_or_create()
#
#
# circuits = e.season(2022).get_circuits()
# statues = e.season(2022).get_statuses()
# seasos = e.limit(100).get_seasons()
#
# print(drivers)

if __name__ == '__main__':
    e = ErgastDataMapper()
    # e.update_drivers()
    # e.update_constructors()
    # e.update_circuits()
    # e.update_seasons()
    # e.update_seasons()
    #
    e.update_races()
    qualifying = e.ergast_instance.season(2022).limit(100000).get_qualifyings()
    print(qualifying)
