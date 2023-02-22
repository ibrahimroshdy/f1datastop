# -*- encoding: utf-8 -*-
"""
Copyright (c) 2019 - present AppSeed.us
"""

from django.contrib import admin
from django.urls import include, path  # add this

admin.site.site_header = "F1 DataStop Admin"
admin.site.site_title = "F1 DataStop Admin Portal"
admin.site.index_title = "Welcome to Formula 1 - DataStop Project Portal"

urlpatterns = [
    path('admin/', admin.site.urls),  # Django admin route
    path("", include("apps.authentication.urls")),  # Auth routes - login / register

    # ADD NEW Routes HERE

    # Leave `Home.Urls` as last the last line
    path("", include("apps.home.urls"))
]
