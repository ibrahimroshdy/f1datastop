from django.contrib import admin

from apps.formula1 import models


class RacesInlineAdmin(admin.TabularInline):
    model = models.Races


class QualifyingInlineAdmin(admin.TabularInline):
    model = models.Qualifying


class SprintResultsInlineAdmin(admin.TabularInline):
    model = models.Sprintresults


class ConstructorResultsInlineAdmin(admin.TabularInline):
    model = models.Constructorresults


class ResultsInlineAdmin(admin.TabularInline):
    model = models.Results
    ordering = ('positionorder',)


class PitstopsInlineAdmin(admin.TabularInline):
    model = models.Pitstops
    ordering = ('stop',)

