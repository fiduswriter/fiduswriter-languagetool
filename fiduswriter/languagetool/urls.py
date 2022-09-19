from django.urls import re_path

from . import views

urlpatterns = [
    re_path("^check/$", views.check, name="lt_check"),
    re_path("^languages/$", views.languages, name="lt_languages"),
]
