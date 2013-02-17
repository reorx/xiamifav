import os

root = os.path.dirname(__file__)


PROJECT = 'xiamifav'

LOCALE = 'en_US'

PROCESSES = 1

PORT = os.environ.get('PORT', 7000)

DEBUG = True

LOGGING = {
    'level': 'INFO',
    'propagate': 1,
    'color': True,
}

LOG_REQUEST = True

LOG_RESPONSE = False

TIME_ZONE = 'Asia/Shanghai'

STATIC_PATH = os.path.join(root, 'static')

TEMPLATE_PATH = os.path.join(root, 'template')

LOGGING_IGNORE_URLS = [
    '/favicon.ico',
]

# shared variables

API_URLS = {
    'fav_songs': 'http://api.xiami.com/app/android/lib-songs?uid=%(uid)s&page=%(page)s',
}

FAKE_USER_AGENT = 'Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'

XIAMI_AUTH_COOKIE = 'member_auth'
