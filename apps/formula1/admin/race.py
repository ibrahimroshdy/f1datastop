from django.contrib import admin

from apps.formula1 import models
from .abstract import ReadOnlyAdmin
from .inlines import PitstopsInlineAdmin, QualifyingInlineAdmin, ResultsInlineAdmin, SprintResultsInlineAdmin


@admin.register(models.Races)
class RacesAdmin(ReadOnlyAdmin):
    list_display = ['circuitid', 'date', 'time', 'round']
    search_fields = ['name', 'circuitid__name', 'circuitid__location', 'circuitid__country']
    list_filter = ['circuitid__country', 'round']
    date_hierarchy = 'date'
    inlines = [ResultsInlineAdmin, QualifyingInlineAdmin, SprintResultsInlineAdmin, PitstopsInlineAdmin]


@admin.register(models.Qualifying)
class QualifyingAdmin(ReadOnlyAdmin):
    list_display = ['raceid', 'driverid', 'number', 'constructorid', 'position', 'q1', 'q2', 'q3']
    search_fields = ['raceid__name', 'q1', 'q2', 'q3',
                     'raceid__circuitid__name', 'raceid__circuitid__location', 'raceid__circuitid__country',
                     'driverid__forename', 'driverid__surname', 'driverid__nationality', 'driverid__code',
                     'constructorid__name', 'constructorid__nationality']
    list_filter = ['raceid__circuitid__country', ]
    date_hierarchy = 'raceid__date'


@admin.register(models.Laptimes)
class LaptimesAdmin(ReadOnlyAdmin):
    list_display = ['raceid', 'driverid', 'lap', 'position', 'time', 'milliseconds']
    search_fields = ['raceid__name', 'driverid__surame', 'lap', 'position', 'time', 'milliseconds']
    date_hierarchy = 'raceid__date'


@admin.register(models.Pitstops)
class PitstopsAdmin(ReadOnlyAdmin):
    list_display = ['raceid', 'driverid', 'stop', 'lap', 'duration']
    search_fields = ['raceid__name', 'stop', 'lap', 'duration',
                     'raceid__circuitid__name', 'raceid__circuitid__location', 'raceid__circuitid__country',
                     'driverid__forename', 'driverid__surname', 'driverid__nationality', 'driverid__code']
    list_filter = ['raceid__circuitid__country', ]
    date_hierarchy = 'raceid__date'
