from django.contrib import admin

from apps.formula1 import models
from .abstract import ReadOnlyAdmin
from .inlines import RacesInlineAdmin


@admin.register(models.Drivers)
class DriversAdmin(ReadOnlyAdmin):
    """Admin view for Driver Model"""
    list_display = ['name', 'code', 'number', 'nationality']
    search_fields = ['surname', 'forename', 'number', 'code', 'nationality']
    list_filter = ['nationality']
    date_hierarchy = 'dob'

    def name(self, instance):
        """Resolves full name from forename and surname"""
        return f'{instance.forename} {instance.surname}'


@admin.register(models.Constructors)
class ConstructorsAdmin(ReadOnlyAdmin):
    """ConstructorsAdmin View for Constructors Model"""
    list_display = ['name', 'nationality']
    search_fields = ['name', 'nationality']
    list_filter = ['nationality']


@admin.register(models.Circuits)
class CircuitsAdmin(ReadOnlyAdmin):
    """CircuitsAdmin View for Circuits Model"""
    list_display = ['name', 'location', 'country']
    search_fields = ['name', 'location', 'country']
    list_filter = ['country']
    inlines = [RacesInlineAdmin, ]


@admin.register(models.Seasons)
class SeasonsAdmin(ReadOnlyAdmin):
    """SeasonsAdmin View for Seasons Model"""
    list_display = ['year', 'url']
    search_fields = ['year']
    inlines = [RacesInlineAdmin]


@admin.register(models.Status)
class StatusAdmin(ReadOnlyAdmin):
    """StatusAdmin View for Status Model"""
    list_display = ['status', 'statusid']
    search_fields = ['status']
    list_filter = ['status']
