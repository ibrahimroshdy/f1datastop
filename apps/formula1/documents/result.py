from django_elasticsearch_dsl.registries import registry
from django_elasticsearch_dsl_drf.compat import StringField

from apps.formula1 import models
from .abstract import AbstractDocument, RaceDriverConstructorAbsDocument
from .fields import ES_ANALYZER_KEYWORD, ES_CONSTRUCTOR_FIELD, ES_DRIVER_FIELD, ES_RACE_FIELD


@registry.register_document
class ResultsDocument(RaceDriverConstructorAbsDocument):
    # Model fields
    positiontext = StringField(analyzer=ES_ANALYZER_KEYWORD)
    time = StringField(analyzer=ES_ANALYZER_KEYWORD)
    fastestlaptime = StringField(analyzer=ES_ANALYZER_KEYWORD)
    fastestlapspeed = StringField(analyzer=ES_ANALYZER_KEYWORD)

    # Model foreign keys
    raceid = ES_RACE_FIELD
    driverid = ES_DRIVER_FIELD
    constructorid = ES_CONSTRUCTOR_FIELD

    class Index(AbstractDocument.Index):
        name = 'results'

    class Django(AbstractDocument.Django):
        model = models.Results
        fields = [
            'resultid',
            'laps',
            'number',
            'grid',
            'position',
            'positionorder',
            'points',
            'milliseconds',
            'fastestlap',
            'rank'
        ]

# TODO: add more results models
