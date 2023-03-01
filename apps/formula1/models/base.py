from django.db import models


class Drivers(models.Model):
    """Driver Model"""
    driverid = models.BigAutoField(db_column='driverId', primary_key=True)  # Field name made lowercase.
    driverref = models.CharField(db_column='driverRef', max_length=255)  # Field name made lowercase.
    number = models.IntegerField(blank=True, null=True)
    code = models.CharField(max_length=3, blank=True, null=True)
    forename = models.CharField(max_length=255)
    surname = models.CharField(max_length=255)
    dob = models.DateField(blank=True, null=True)
    nationality = models.CharField(max_length=255, blank=True, null=True)
    url = models.URLField(max_length=512, db_column='url', unique=True)

    def __str__(self):
        return f'{self.forename} {self.surname}'

    class Meta:
        db_table = 'drivers'
        verbose_name = 'Driver'
        verbose_name_plural = 'Drivers'


class Constructors(models.Model):
    """Constructors Model"""
    constructorid = models.BigAutoField(db_column='constructorId', primary_key=True)  # Field name made lowercase.
    constructorref = models.CharField(db_column='constructorRef', max_length=255, unique=True)
    name = models.CharField(unique=True, max_length=255)
    nationality = models.CharField(max_length=255, blank=True, null=True)
    url = models.CharField(max_length=255)

    def __str__(self):
        return f'{self.name}'

    class Meta:
        db_table = 'constructors'
        verbose_name = 'Constructor'
        verbose_name_plural = 'Constructors'


class Circuits(models.Model):
    """Circuits Model"""
    circuitid = models.BigAutoField(primary_key=True, db_column='circuitId')  # Field name made lowercase.
    circuitref = models.CharField(max_length=255, db_column='circuitRef', unique=True)  # Field name made lowercase.
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True, null=True)
    country = models.CharField(max_length=255, blank=True, null=True)
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)
    alt = models.IntegerField(blank=True, null=True)
    url = models.CharField(unique=True, max_length=255)

    def __str__(self):
        return f'{self.country}: {self.location}'

    class Meta:
        db_table = 'circuits'
        verbose_name = 'Circuit'
        verbose_name_plural = 'Circuits'


class Seasons(models.Model):
    """Seasons Model"""
    year = models.IntegerField(primary_key=True, db_column='year')
    url = models.CharField(unique=True, max_length=255)

    def __str__(self):
        return f'{self.year}'

    class Meta:
        db_table = 'seasons'
        verbose_name = 'Season'
        verbose_name_plural = 'Seasons'


class Status(models.Model):
    """Status Model"""
    statusid = models.BigAutoField(db_column='statusId', primary_key=True)  # Field name made lowercase.
    status = models.CharField(max_length=255)

    def __str__(self):
        return f'{self.status}'

    class Meta:
        db_table = 'status'
        verbose_name = 'Status'
        verbose_name_plural = 'Statuses'
