from httpx import AsyncClient
from urllib.parse import urljoin

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import HttpResponse

LT_URL = "https://languagetool.org/api/"
if hasattr(settings, "LT_URL"):
    LT_URL = settings.LT_URL


@login_required
@require_POST
async def languages(request):
    data = request.POST
    url = urljoin(LT_URL, "v2/languages")
    async with AsyncClient() as client:
        response = await client.post(
            url,
            data=data,
            timeout=88,  # Firefox times out after 90 seconds, so we need to return before that.
        )
    return HttpResponse(response.text, status=response.status_code)


@login_required
@require_POST
async def check(request):
    data = request.POST
    url = urljoin(LT_URL, "v2/check")
    async with AsyncClient() as client:
        response = await client.post(
            url,
            data=data,
            timeout=88,  # Firefox times out after 90 seconds, so we need to return before that.
        )
    return HttpResponse(response.text, status=response.status_code)
