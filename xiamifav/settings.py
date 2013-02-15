import os


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

STATIC_PATH = 'static'

TEMPLATE_PATH = 'template'

LOGGING_IGNORE_URLS = [
    '/favicon.ico',
]
