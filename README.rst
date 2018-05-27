========================
FidusWriter-Languagetool
========================

FidusWriter-Languagetool is a Fidus writer plugin to connect a Fidus Writer instance
with Languagetool (LT).


Installation
------------

1. Install Fidus Writer if you haven't done so already.

2. Within the virtual environment set up for your Fidus Writer instance, install the version of the plugin corresponding to your Fidus Writer installation. If you are running Fidus Writer 3.2, the command is::

    pip install "fiduswriter-languagetool<3.3"

3. Add "languagetool" to your INSTALLED_APPS setting in the configuration.py file
   like this::

    INSTALLED_APPS += (
        ...
        'languagetool',
    )

4. Add a setting for the URL where you will be running LT in the configuration.py file like this:

    LT_URL = 'http://localhost:8081'

5. Create the needed JavaScript files by running this::

    python manage.py transpile

6. (Re)start your Fidus Writer server.
