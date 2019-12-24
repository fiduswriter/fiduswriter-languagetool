from urllib.parse import urljoin

from tornado.web import RequestHandler, HTTPError
from tornado.httpclient import AsyncHTTPClient
from base.django_handler_mixin import DjangoHandlerMixin
from django.conf import settings

LT_URL = 'https://languagetool.org/api/'
if hasattr(settings, 'LT_URL'):
    LT_URL = settings.LT_URL


class Proxy(DjangoHandlerMixin, RequestHandler):
    async def post(self, relative_url):
        user = self.get_current_user()
        if not user.is_authenticated:
            self.set_status(401)
            self.finish()
            return
        body = self.request.body
        url = urljoin(LT_URL, 'v2/') + relative_url
        http = AsyncHTTPClient()
        response = await http.fetch(
            url,
            method='POST',
            body=body
        )
        if response.error:
            raise HTTPError(500)
        self.write(response.body)
        self.finish()
