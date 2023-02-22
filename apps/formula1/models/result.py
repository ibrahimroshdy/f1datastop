from django.db import models

from .base import Constructors, Drivers, Status
from .race import Races


class Sprintresults(models.Model):
    sprintresultid = models.BigAutoField(db_column='sprintResultId', primary_key=True)  # Field name made lowercase.
    raceid = models.ForeignKey(Races,
                               on_delete=models.CASCADE,
                               db_column='raceId')  # Field name made lowercase.
    driverid = models.ForeignKey(Drivers,
                                 on_delete=models.CASCADE,
                                 db_column='driverId')  # Field name made lowercase.
    constructorid = models.ForeignKey(Constructors,
                                      on_delete=models.CASCADE,
                                      db_column='constructorId')  # Field name made lowercase.
    number = models.IntegerField()
    grid = models.IntegerField()
    position = models.IntegerField(blank=True, null=True)
    positiontext = models.CharField(db_column='positionText', max_length=255)  # Field name made lowercase.
    positionorder = models.IntegerField(db_column='positionOrder')  # Field name made lowercase.
    points = models.FloatField()
    laps = models.IntegerField()
    time = models.CharField(max_length=255, blank=True, null=True)
    milliseconds = models.IntegerField(blank=True, null=True)
    fastestlap = models.IntegerField(db_column='fastestLap', blank=True, null=True)  # Field name made lowercase.
    fastestlaptime = models.CharField(db_column='fastestLapTime', max_length=255, blank=True,
                                      null=True)  # Field name made lowercase.
    statusid = models.ForeignKey(Status,
                                 on_delete=models.CASCADE,
                                 db_column='statusId')  # Field name made lowercase.

    def __str__(self):
        return f'S: {self.raceid}'

    class Meta:
        db_table = 'sprintResults'
        verbose_name = 'Sprint Result'
        verbose_name_plural = 'Sprint Results'


class Constructorresults(models.Model):
    constructorresultsid = models.BigAutoField(db_column='constructorResultsId',
                                               primary_key=True)  # Field name made lowercase.
    raceid = models.ForeignKey(Races,
                               on_delete=models.CASCADE,
                               db_column='raceId')  # Field name made lowercase.
    constructorid = models.ForeignKey(Constructors,
                                      on_delete=models.CASCADE,
                                      db_column='constructorId')  # Field name made lowercase.
    points = models.FloatField(blank=True, null=True)
    status = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f'{self.constructorid.name} - {self.points} - {self.status}'

    class Meta:
        db_table = 'constructorResults'
        verbose_name = 'Constructor Result'
        verbose_name_plural = 'Constructor Results'


class Constructorstandings(models.Model):
    constructorstandingsid = models.BigAutoField(db_column='constructorStandingsId',
                                                 primary_key=True)  # Field name made lowercase.
    raceid = models.ForeignKey(Races,
                               on_delete=models.CASCADE,
                               db_column='raceId')  # Field name made lowercase.
    constructorid = models.ForeignKey(Constructors,
                                      on_delete=models.CASCADE,
                                      db_column='constructorId')  # Field name made lowercase.
    points = models.FloatField()
    position = models.IntegerField(blank=True, null=True)
    positiontext = models.CharField(db_column='positionText', max_length=255, blank=True,
                                    null=True)  # Field name made lowercase.
    wins = models.IntegerField()

    def __str__(self):
        return f'{self.raceid} - {self.wins}'

    class Meta:
        db_table = 'constructorStandings'
        verbose_name = 'Constructor Standing'
        verbose_name_plural = 'Constructor Standings'


class Driverstandings(models.Model):
    driverstandingsid = models.BigAutoField(db_column='driverStandingsId',
                                            primary_key=True)  # Field name made lowercase.
    raceid = models.ForeignKey(Races,
                               on_delete=models.CASCADE,
                               db_column='raceId')  # Field name made lowercase.
    driverid = models.ForeignKey(Drivers,
                                 on_delete=models.CASCADE,
                                 db_column='driverId')  # Field name made lowercase.
    points = models.FloatField()
    position = models.IntegerField(blank=True, null=True)
    positiontext = models.CharField(db_column='positionText', max_length=255, blank=True,
                                    null=True)  # Field name made lowercase.
    wins = models.IntegerField()

    def __str__(self):
        return f'{self.driverid} - {self.raceid}: {self.points} -- {self.position}'

    class Meta:
        db_table = 'driverStandings'
        verbose_name = 'Driver Standing'
        verbose_name_plural = 'Driver Standings'


class Results(models.Model):
    resultid = models.BigAutoField(db_column='resultId', primary_key=True)  # Field name made lowercase.
    raceid = models.ForeignKey(Races,
                               on_delete=models.CASCADE,
                               db_column='raceId')  # Field name made lowercase.
    driverid = models.ForeignKey(Drivers,
                                 on_delete=models.CASCADE,
                                 db_column='driverId')  # Field name made lowercase.
    constructorid = models.ForeignKey(Constructors,
                                      on_delete=models.CASCADE,
                                      db_column='constructorId')  # Field name made lowercase.
    number = models.IntegerField(blank=True, null=True)
    grid = models.IntegerField()
    position = models.IntegerField(blank=True, null=True)
    positiontext = models.CharField(db_column='positionText', max_length=255)  # Field name made lowercase.
    positionorder = models.IntegerField(db_column='positionOrder')  # Field name made lowercase.
    points = models.FloatField()
    laps = models.IntegerField()
    time = models.CharField(max_length=255, blank=True, null=True)
    milliseconds = models.IntegerField(blank=True, null=True)
    fastestlap = models.IntegerField(db_column='fastestLap', blank=True, null=True)  # Field name made lowercase.
    rank = models.IntegerField(blank=True, null=True)
    fastestlaptime = models.CharField(db_column='fastestLapTime', max_length=255, blank=True,
                                      null=True)  # Field name made lowercase.
    fastestlapspeed = models.CharField(db_column='fastestLapSpeed', max_length=255, blank=True,
                                       null=True)  # Field name made lowercase.
    statusid = models.ForeignKey(Status,
                                 on_delete=models.CASCADE,
                                 db_column='statusId')  # Field name made lowercase.

    class Meta:
        db_table = 'results'
        verbose_name = 'Result'
        verbose_name_plural = 'Results'
