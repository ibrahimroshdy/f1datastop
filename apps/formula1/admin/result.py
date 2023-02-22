from django.contrib import admin

from apps.formula1 import models
from .abstract import ReadOnlyAdmin


@admin.register(models.Driverstandings)
class DriverstandingsAdmin(ReadOnlyAdmin):
    list_display = ['raceid', 'driverid', 'points', 'wins']
    list_filter = ['driverid__code']
    date_hierarchy = 'raceid__date'


@admin.register(models.Constructorresults)
class ConstructorresultsAdmin(ReadOnlyAdmin):
    list_display = ['raceid', 'constructorid', 'points', 'status']
    list_filter = ['constructorid__name']
    date_hierarchy = 'raceid__date'


@admin.register(models.Results)
class ResultsAdmin(ReadOnlyAdmin):
    list_display = ['raceid', 'driverid', 'constructorid', 'number', 'grid', 'rank', 'statusid', 'points']
    list_filter = ['constructorid__name', 'driverid__surname']
    search_fields = ['driverid__surname']
    date_hierarchy = 'raceid__date'
