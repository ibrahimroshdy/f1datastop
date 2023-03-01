from django_elasticsearch_dsl import fields
from django_elasticsearch_dsl_drf.compat import StringField
from elasticsearch_dsl import analyzer

# Elastic Search funzziness search
FUZZY_SEARCH_PROPERTIES = {'fuzziness': 'AUTO'}

#Elastic Search Analyzer
ES_ANALYZER_KEYWORD = analyzer(
        'keyword_analyzer',
        tokenizer="keyword",  # default tokenizer
)

# StringField of Elastic search
ES_STIRNG_FIELD = StringField(analyzer=ES_ANALYZER_KEYWORD)

# Object field for the Circuit Model
ES_CIRCUIT_FIELD = fields.ObjectField(properties={
    'name': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'location': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'country': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'geo_location': fields.GeoPointField(),
})

# ES Object field for the Race Model
ES_RACE_FIELD = fields.ObjectField(properties={
    'round': fields.IntegerField(),
    'name': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'date': fields.DateField(),
    'time': fields.TimeField(),
    'year': fields.ObjectField(properties={
        'year': fields.IntegerField()
    }),
    'fp1_date': fields.DateField(),
    'fp1_time': fields.TimeField(),
    'fp2_date': fields.DateField(),
    'fp2_time': fields.TimeField(),
    'fp3_date': fields.DateField(),
    'fp3_time': fields.TimeField(),
    'quali_date': fields.DateField(),
    'quali_time': fields.TimeField(),
    'sprint_date': fields.DateField(),
    'sprint_time': fields.TimeField(),
    'circuitid': fields.ObjectField(properties={
        'name': StringField(analyzer=ES_ANALYZER_KEYWORD),
        'location': StringField(analyzer=ES_ANALYZER_KEYWORD),
        'country': StringField(analyzer=ES_ANALYZER_KEYWORD),
        'geo_location': fields.GeoPointField(),
    })

})

# ES Object field for the Driver Model
ES_DRIVER_FIELD = fields.ObjectField(properties={
    'nationality': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'code': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'forename': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'surname': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'name': StringField(analyzer=ES_ANALYZER_KEYWORD)
})

# ES Object field for the Constructor Model
ES_CONSTRUCTOR_FIELD = fields.ObjectField(properties={
    'name': StringField(analyzer=ES_ANALYZER_KEYWORD),
    'nationality': StringField(analyzer=ES_ANALYZER_KEYWORD),
})

# ES Object field for the Seasons Model
ES_YEAR_FIELD = fields.ObjectField(properties={
    'year': fields.IntegerField()
})
