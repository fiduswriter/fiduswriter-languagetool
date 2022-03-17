========================
FidusWriter-Languagetool
========================

FidusWriter-Languagetool is a Fidus writer plugin to connect a Fidus Writer instance
with Languagetool (LT).

**NOTE:** You should first install Languagetool (a Java program) and make it run as a server. It is included in the Ubuntu Snap version of Fidus Writer so that will be the simplest way to install it for 99% of users. 

Installation
------------

1. Install Fidus Writer with the correct version of the plugin like this:

    pip install fiduswriter[languagetool]

2. Add "languagetool" to your INSTALLED_APPS setting in the configuration.py file
   like this::

    INSTALLED_APPS += (
        ...
        'languagetool',
    )

3. Add a setting for the URL where you are running Languagetool in the configuration.py file like this:

    LT_URL = 'http://localhost:8081'

4. Create the needed JavaScript files by running this::

    python manage.py transpile

5. (Re)start your Fidus Writer server.
