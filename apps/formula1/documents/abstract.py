from django_elasticsearch_dsl import Document

from .fields import (ES_ANALYZER_KEYWORD, ES_CIRCUIT_FIELD, ES_CONSTRUCTOR_FIELD, ES_DRIVER_FIELD, ES_RACE_FIELD,
                     ES_YEAR_FIELD)


class AbstractDocument(Document):
    """
    Abstract Elasticsearch document class that contains common functionality for all Elasticsearch documents in the project.
    """

    class Index:
        """
        Defines the index settings for the document. In this example, we set the number of shards and replicas, as well as an
        analyzer for Elasticsearch that we will use in our document fields.
        """
        settings = {
            'number_of_shards': 1,
            'number_of_replicas': 0,
            'analysis': {
                'analyzer': {
                    'ES_ANALYZER_KEYWORD': ES_ANALYZER_KEYWORD
                }
            }
        }

    class Django:
        """
        Defines the Django model fields to include in the Elasticsearch document.
        """
        fields = ['id']


class YearCircuitAbsDocument(AbstractDocument):
    """
    A document representing the relationship between a year and a circuit.
    """

    # Define object fields to store foreign keys
    year = ES_YEAR_FIELD
    circuitid = ES_CIRCUIT_FIELD

    def prepare_circuitid(self, instance):
        """
        Prepare the `circuitid` field by extracting relevant data from the related `Circuit` object.

        Args:
            instance: The `YearCircuitAbs` instance to prepare.

        Returns:
            A dictionary containing the desired data for the `circuitid` field.
        """

        # Retrieve the related Circuit object for the given Races instance
        circuit = instance.circuitid

        # Extract the desired values from the related Circuit object
        latitude = circuit.lat
        longitude = circuit.lng

        # Create a dictionary with the extracted values and prepare the `geo_location` field
        geo_location = {"lat": latitude, "lon": longitude}

        # Create a dictionary containing the remaining fields
        properties = {
            'name': circuit.name,
            'location': circuit.location,
            'country': circuit.country,
            'geo_location': geo_location,
        }

        # Return the prepared properties
        return properties


class RaceDriverAbsDocument(AbstractDocument):
    """
        ElasticSearch document class for RaceDriver model, containing foreign key fields for Race and Driver models.
        Overrides prepare_raceid and prepare_driverid methods to prepare values for the indexed document.
    """

    # Model foreign keys (object fields)
    raceid = ES_RACE_FIELD
    driverid = ES_DRIVER_FIELD

    def prepare_raceid(self, instance):
        """
        Prepare values for the indexed document from the related Race instance.
        """
        # Retrieve the related Race object for the given RaceDriver instance
        race = instance.raceid

        # Extract desired values from the related Race object
        _round = race.round
        name = race.name
        date = race.date
        time = race.time.isoformat() if race.time else None
        year = race.year.year

        # P1, P2, P3, Quali, Sprint dates
        fp1_date = race.fp1_date
        fp2_date = race.fp2_date
        fp3_date = race.fp3_date
        quali_date = race.quali_date
        sprint_date = race.sprint_date

        # P1, P2, P3, Quali, Sprint times
        # Serialize time to .isoformat() to be str
        fp1_time = race.fp1_time.isoformat() if race.fp1_time else None
        fp2_time = race.fp2_time.isoformat() if race.fp2_time else None
        fp3_time = race.fp3_time.isoformat() if race.fp3_time else None
        quali_time = race.quali_time.isoformat() if race.quali_time else None
        sprint_time = race.sprint_time.isoformat() if race.sprint_time else None

        # Retrieve the related Circuit object for the given Race instance
        circuit = race.circuitid

        # Extract the desired values from the related Circuit object
        latitude = circuit.lat
        longitude = circuit.lng

        # Create a dictionary with the extracted values and prepare the `geo_location` field
        geo_location = {"lat": latitude, "lon": longitude}

        # Prepare properties dictionary to be returned to `raceid` object field
        properties = {
            'round': _round,
            'name': name,
            'date': date,
            'time': time,
            'year': {
                'year': year
            },
            'fp1_date': fp1_date,
            'fp1_time': fp1_time,
            'fp2_date': fp2_date,
            'fp2_time': fp2_time,
            'fp3_date': fp3_date,
            'fp3_time': fp3_time,
            'quali_date': quali_date,
            'quali_time': quali_time,
            'sprint_date': sprint_date,
            'sprint_time': sprint_time,
            'circuitid': {
                'name': circuit.name,
                'location': circuit.location,
                'country': circuit.country,
                'geo_location': geo_location,
            }
        }

        return properties

    def prepare_driverid(self, instance):
        """
        Prepare values for the indexed document from the related Driver instance.
        """
        # Retrieve the related Driver object for the given RaceDriver instance
        driver = instance.driverid

        # Extract desired values from the related Driver object
        nationality = driver.nationality
        code = driver.code
        forename = driver.forename
        surname = driver.surname

        # Resolve full name from forename and surname
        name = f'{forename} {surname}'

        # Prepare properties dicttionary to be returned to raceid object field
        properties = {
            'nationality': nationality,
            'code': code,
            'forename': forename,
            'surname': surname,
            'name': name,

        }

        return properties


class RaceDriverConstructorAbsDocument(AbstractDocument):
    """
    A class for preparing race, driver, and constructor objects for Elasticsearch indexing.

    Inherits from the AbstractDocument class.
    """

    # Model foreign keys (object fields)
    raceid = ES_RACE_FIELD
    driverid = ES_DRIVER_FIELD
    constructorid = ES_CONSTRUCTOR_FIELD

    def prepare_raceid(self, instance):
        """
        Prepares a race object for Elasticsearch indexing.

        :param instance: The Qualifying instance to prepare.
        :return: A dictionary with the prepared race object properties.
        """

        # Retrieve the related Race object for the given Qualifying instance
        race = instance.raceid

        # Extract desired race properties
        _round = race.round
        name = race.name
        date = race.date
        time = race.time.isoformat() if race.time else None
        year = race.year.year

        # Extract date and time properties for P1, P2, P3, Quali, and Sprint
        fp1_date = race.fp1_date
        fp2_date = race.fp2_date
        fp3_date = race.fp3_date
        quali_date = race.quali_date
        sprint_date = race.sprint_date

        fp1_time = race.fp1_time.isoformat() if race.fp1_time else None
        fp2_time = race.fp2_time.isoformat() if race.fp2_time else None
        fp3_time = race.fp3_time.isoformat() if race.fp3_time else None
        quali_time = race.quali_time.isoformat() if race.quali_time else None
        sprint_time = race.sprint_time.isoformat() if race.sprint_time else None

        # Retrieve the related Circuit object for the given Drivers instance
        circuit = race.circuitid

        # Extract the latitude and longitude properties from the Circuit object
        latitude = circuit.lat
        longitude = circuit.lng

        # Create a dictionary with the extracted values and prepare the `geo_location` field
        geo_location = {"lat": latitude, "lon": longitude}

        # Prepare properties dictionary to be returned for the raceid object field
        properties = {
            'round': _round,
            'name': name,
            'date': date,
            'time': time,
            'year': {
                'year': year
            },
            'fp1_date': fp1_date,
            'fp1_time': fp1_time,
            'fp2_date': fp2_date,
            'fp2_time': fp2_time,
            'fp3_date': fp3_date,
            'fp3_time': fp3_time,
            'quali_date': quali_date,
            'quali_time': quali_time,
            'sprint_date': sprint_date,
            'sprint_time': sprint_time,
            'circuitid': {
                'name': circuit.name,
                'location': circuit.location,
                'country': circuit.country,
                'geo_location': geo_location,
            }
        }

        return properties

    def prepare_driverid(self, instance):
        """
        Prepares a driver object for Elasticsearch indexing.

        :param instance: The Qualifying instance to prepare.
        :return: A dictionary with the prepared driver object properties.
        """

        driver = instance.driverid

        nationality = driver.nationality
        code = driver.code
        forename = driver.forename
        surname = driver.surname

        # Resolve full name from forename and surname
        name = f'{forename} {surname}'

        # Prepare properties dicttionary to be returned to raceid object field
        properties = {
            'nationality': nationality,
            'code': code,
            'forename': forename,
            'surname': surname,
            'name': name,
        }

        return properties
