from urllib.parse import urljoin

from tornado.web import RequestHandler, asynchronous, HTTPError
from tornado.httpclient import AsyncHTTPClient
from base.django_handler_mixin import DjangoHandlerMixin
from django.conf import settings

LT_URL = 'https://languagetool.org/api/'
if hasattr(settings, 'LT_URL'):
    LT_URL = settings.LT_URL


class Proxy(DjangoHandlerMixin, RequestHandler):
    @asynchronous
    def post(self, relative_url):
        user = self.get_current_user()
        if not user.is_authenticated:
            self.set_status(401)
            self.finish()
            return
        body = self.request.body
        url = urljoin(LT_URL, 'v2/') + relative_url
        http = AsyncHTTPClient()
        http.fetch(
            url,
            method='POST',
            body=body,
            callback=self.on_response
        )

    # The response is asynchronous so that the getting of the data from the
    # remote server doesn't block the server connection.
    def on_response(self, response):
        if response.error:
            raise HTTPError(500)
        self.write(response.body)
        self.finish()
