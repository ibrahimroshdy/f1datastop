from django.db import models

from .base import Circuits, Constructors, Drivers, Seasons


class Races(models.Model):
    raceid = models.BigAutoField(db_column='raceId', primary_key=True)  # Field name made lowercase.
    year = models.ForeignKey(Seasons, on_delete=models.CASCADE, db_column='year')
    round = models.IntegerField()
    circuitid = models.ForeignKey(Circuits,
                                  on_delete=models.CASCADE,
                                  db_column='circuitId')  # Field name made lowercase.
    name = models.CharField(max_length=255)
    date = models.DateField()
    time = models.TimeField(blank=True, null=True)
    url = models.CharField(unique=True, max_length=255, blank=True, null=True)
    fp1_date = models.DateField(blank=True, null=True)
    fp1_time = models.TimeField(blank=True, null=True)
    fp2_date = models.DateField(blank=True, null=True)
    fp2_time = models.TimeField(blank=True, null=True)
    fp3_date = models.DateField(blank=True, null=True)
    fp3_time = models.TimeField(blank=True, null=True)
    quali_date = models.DateField(blank=True, null=True)
    quali_time = models.TimeField(blank=True, null=True)
    sprint_date = models.DateField(blank=True, null=True)
    sprint_time = models.TimeField(blank=True, null=True)

    def __str__(self):
        return f'R: {self.year} - {self.circuitid.country}: {self.circuitid.location}'

    class Meta:
        db_table = 'races'
        verbose_name = 'Race'
        verbose_name_plural = 'Races'


class Qualifying(models.Model):
    qualifyid = models.BigAutoField(db_column='qualifyId', primary_key=True)  # Field name made lowercase.
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
    position = models.IntegerField(blank=True, null=True)
    q1 = models.CharField(max_length=255, blank=True, null=True)
    q2 = models.CharField(max_length=255, blank=True, null=True)
    q3 = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f'Q: {self.raceid.year} Q[{self.raceid.name}] D[{self.driverid.driverref}] POS [{self.position}]'

    class Meta:
        db_table = 'qualifying'
        verbose_name = 'Qualifying'
        verbose_name_plural = 'Qualifyings'


class Laptimes(models.Model):
    raceid = models.ForeignKey(Races,
                               on_delete=models.CASCADE,
                               db_column='raceId')  # Field name made lowercase.
    driverid = models.ForeignKey(Drivers,
                                 on_delete=models.CASCADE,
                                 db_column='driverId')  # Field name made lowercase.
    lap = models.IntegerField()
    position = models.IntegerField(blank=True, null=True)
    time = models.CharField(max_length=255, blank=True, null=True)
    milliseconds = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f'LT: {self.raceid.year} R[{self.raceid.name}] D[{self.driverid}] - L{self.lap}@{self.time}:{self.milliseconds}'

    class Meta:
        db_table = 'lapTimes'
        verbose_name = 'Lap Time'
        verbose_name_plural = 'Lap Times'
        unique_together = (('raceid', 'driverid', 'lap'),)


class Pitstops(models.Model):
    raceid = models.ForeignKey(Races,
                               on_delete=models.CASCADE,
                               db_column='raceId')  # Field name made lowercase.
    driverid = models.ForeignKey(Drivers,
                                 on_delete=models.CASCADE,
                                 db_column='driverId')  # Field name made lowercase.
    stop = models.IntegerField()
    lap = models.IntegerField()
    time = models.TimeField()
    duration = models.CharField(max_length=255, blank=True, null=True)
    milliseconds = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f'PS: {self.raceid.year} R[{self.raceid.name}] D[{self.driverid}] - L{self.lap}S{self.stop}@{self.duration}'

    class Meta:
        db_table = 'pitStops'
        verbose_name = 'Pitstop'
        verbose_name_plural = 'Pitstops'
        unique_together = (('raceid', 'driverid', 'stop'),)
