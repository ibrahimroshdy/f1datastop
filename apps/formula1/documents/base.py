from django_elasticsearch_dsl import fields
from django_elasticsearch_dsl.registries import registry
from django_elasticsearch_dsl_drf.compat import StringField

from apps.formula1 import models
from .abstract import AbstractDocument
from .fields import ES_ANALYZER_KEYWORD


@registry.register_document
class DriversDocument(AbstractDocument):
    nationality = StringField(analyzer=ES_ANALYZER_KEYWORD)
    code = StringField(analyzer=ES_ANALYZER_KEYWORD)
    forename = StringField(analyzer=ES_ANALYZER_KEYWORD)
    surname = StringField(analyzer=ES_ANALYZER_KEYWORD)
    name = StringField(analyzer=ES_ANALYZER_KEYWORD)

    class Index(AbstractDocument.Index):
        name = 'drivers'

    class Django(AbstractDocument.Django):
        model = models.Drivers
        fields = [
            'driverid',
            'driverref',
            'number',
            'dob',
        ]

    def prepare_name(self, instance):
        return f'{instance.forename} {instance.surname}'


@registry.register_document
class ConstructorsDocument(AbstractDocument):
    name = StringField(analyzer=ES_ANALYZER_KEYWORD)
    nationality = StringField(analyzer=ES_ANALYZER_KEYWORD)

    class Index(AbstractDocument.Index):
        name = 'constructors'

    class Django(AbstractDocument.Django):
        model = models.Constructors
        fields = [
            'constructorid',
            'constructorref',
        ]


@registry.register_document
class CircuitsDocument(AbstractDocument):
    name = StringField(analyzer=ES_ANALYZER_KEYWORD)
    location = StringField(analyzer=ES_ANALYZER_KEYWORD)
    country = StringField(analyzer=ES_ANALYZER_KEYWORD)
    lat = fields.FloatField()
    lng = fields.FloatField()
    geo_location = fields.GeoPointField()

    class Index(AbstractDocument.Index):
        name = 'circuits'

    class Django(AbstractDocument.Django):
        model = models.Circuits
        fields = [
            'circuitid',
            'circuitref',
        ]

    def prepare_geo_location(self, instance):
        # Create a tuple of (latitude, longitude) from the instance's latitude and longitude fields
        lat_long = (instance.lat, instance.lng)
        # Return the tuple as a string in the format "lat,lon" to be used as the value for the `location` field
        return "{},{}".format(*lat_long)


@registry.register_document
class SeasonsDocument(AbstractDocument):
    url = StringField(analyzer=ES_ANALYZER_KEYWORD)

    class Index(AbstractDocument.Index):
        name = 'seasons'

    class Django(AbstractDocument.Django):
        model = models.Seasons
        fields = [
            'year'
        ]


@registry.register_document
class StatusDocument(AbstractDocument):
    status = StringField(analyzer=ES_ANALYZER_KEYWORD)

    class Index(AbstractDocument.Index):
        name = 'status'

    class Django(AbstractDocument.Django):
        model = models.Status
        fields = [
            'statusid'
        ]
