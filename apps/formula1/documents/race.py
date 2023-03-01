""" Racing documents for indexing """

from django_elasticsearch_dsl.registries import registry
from django_elasticsearch_dsl_drf.compat import StringField

from apps.formula1 import models
from .abstract import AbstractDocument, RaceDriverAbsDocument, RaceDriverConstructorAbsDocument, YearCircuitAbsDocument
from .fields import (ES_ANALYZER_KEYWORD, ES_CIRCUIT_FIELD, ES_CONSTRUCTOR_FIELD, ES_DRIVER_FIELD, ES_RACE_FIELD,
                     ES_YEAR_FIELD)


@registry.register_document
class RacesDocument(YearCircuitAbsDocument):
    """
    A document class for indexing Races objects in Elasticsearch.

    This document includes model fields and foreign keys, as well as an index and a Django model definition.

    Index:
    ------
    RacesDocument.Index
        An Elasticsearch index object for the Races document, named 'races'.

    Django:
    -------
    RacesDocument.Django
        A Django model object that maps to the Races object and includes a list of fields to be indexed.
    """

    # Model fields
    name = StringField(analyzer=ES_ANALYZER_KEYWORD)
    url = StringField(analyzer=ES_ANALYZER_KEYWORD)

    # Model foreign keys (object fields)
    year = ES_YEAR_FIELD
    circuitid = ES_CIRCUIT_FIELD

    class Index(AbstractDocument.Index):
        """An Elasticsearch index class for the Races document"""
        name = 'races'

    class Django(AbstractDocument.Django):
        """A Django model class for the Races document that includes a list of fields to be indexed"""
        model = models.Races
        fields = [
            'raceid',
            'round',
            'date',
            'time',
            'fp1_date',
            'fp1_time',
            'fp2_date',
            'fp2_time',
            'fp3_date',
            'fp3_time',
            'quali_date',
            'quali_time',
            'sprint_date',
            'sprint_time'
        ]


# @registry.register_document
class QualifyingDocument(RaceDriverConstructorAbsDocument):
    """
        Elasticsearch document representing the Qualifying model.
        This document includes model fields and foreign keys, as well as an index and a Django model definition.

    Index:
    ------
    QualifyingDocument.Index
        An Elasticsearch index object for the Qualifying document, named 'qualifying'.

    Django:
    -------
    QualifyingDocument.Django
        A Django model object that maps to the Qualifying object and includes a list of fields to be indexed.
    """

    # Model fields
    q1 = StringField(analyzer=ES_ANALYZER_KEYWORD)
    q2 = StringField(analyzer=ES_ANALYZER_KEYWORD)
    q3 = StringField(analyzer=ES_ANALYZER_KEYWORD)

    # Model foreign keys (object fields)
    raceid = ES_RACE_FIELD
    driverid = ES_DRIVER_FIELD
    constructorid = ES_CONSTRUCTOR_FIELD

    class Index(AbstractDocument.Index):
        """Elasticsearch index configuration for QualifyingDocument"""
        name = 'qualifying'

    class Django(AbstractDocument.Django):
        """Django model configuration for QualifyingDocument"""
        model = models.Qualifying
        fields = [
            'qualifyid',
            'number',
            'position',
        ]


# @registry.register_document
class LaptimesDocument(RaceDriverAbsDocument):
    """
        Elasticsearch document representing laptimes of drivers in races.
        This document includes model fields and foreign keys, as well as an index and a Django model definition.

    Index:
    ------
    LaptimesDocument.Index
        An Elasticsearch index object for the Laptimes document, named 'laptimes'.

    Django:
    -------
    LaptimesDocument.Django
        A Django model object that maps to the Laptimes object and includes a list of fields to be indexed.
    """

    # Model fields
    time = StringField(analyzer=ES_ANALYZER_KEYWORD)

    # Model foreign keys (object fields)
    raceid = ES_RACE_FIELD
    driverid = ES_DRIVER_FIELD

    class Index(AbstractDocument.Index):
        """Elasticsearch index configuration for LaptimesDocument"""
        name = 'laptimes'

    class Django(AbstractDocument.Django):
        """Django model configuration for LaptimesDocument"""
        model = models.Laptimes
        fields = [
            'lap',
            'position',
            'milliseconds'
        ]


# @registry.register_document
class PitstopsDocument(RaceDriverAbsDocument):
    """
        Elasticsearch document representing pitstops of drivers in races.
        This document includes model fields and foreign keys, as well as an index and a Django model definition.

    Index:
    ------
    PitstopsDocument.Index
        An Elasticsearch index object for the Pitstops document, named 'pitstops'.

    Django:
    -------
    PitstopsDocument.Django
        A Django model object that maps to the Pitstops object and includes a list of fields to be indexed.
    """
    # Model fields
    duration = StringField(analyzer=ES_ANALYZER_KEYWORD)

    # Model foreign keys (object fields)
    raceid = ES_RACE_FIELD
    driverid = ES_DRIVER_FIELD

    class Index(AbstractDocument.Index):
        """Elasticsearch index configuration for PitstopsDocument"""
        name = 'pitstops'

    class Django(AbstractDocument.Django):
        """Django model configuration for PitstopsDocument"""
        model = models.Pitstops
        fields = [
            'stop',
            'lap',
            'time',
            'milliseconds'
        ]
