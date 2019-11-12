# flake8: noqa
from mediathread.settings_shared import *

DEBUG = False
TEMPLATES[0]['OPTIONS']['debug'] = DEBUG

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'OPTIONS': {
            'timeout': 30,
        },
        'ATOMIC_REQUESTS': True
    }
}

BROWSER = 'Headless'
# BROWSER = 'Firefox'
# BROWSER = 'Chrome'

INSTALLED_APPS = INSTALLED_APPS + [
    'aloe_django',
]

PASSWORD_HASHERS = (
    'django.contrib.auth.hashers.MD5PasswordHasher',
)

MIDDLEWARE.remove(
    'django_statsd.middleware.GraphiteRequestTimingMiddleware')
MIDDLEWARE.remove(
    'django_statsd.middleware.GraphiteMiddleware')
MIDDLEWARE.remove(
    'impersonate.middleware.ImpersonateMiddleware')

ALLOWED_HOSTS.append('127.0.0.1')
