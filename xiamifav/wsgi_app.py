#!/usr/bin/env python
# -*- coding: utf-8 -*-

from torext.app import TorextApp
import settings

app = TorextApp(settings)
app.setup()

import logging
import requests
from Cookie import SimpleCookie
from xiamifav.base import BaseHandler, HomeHandler


class LoginHandler(BaseHandler):
    URL = 'http://www.xiami.com/app/iphone/login/email/%(email)s/pwd/%(password)s'

    def post(self):
        try:
            url = self.URL % self._single_value_arguments()
        except ValueError:
            return self.json_error(400, 'invalid arguments')

        headers = {
            'User-Agent': settings.FAKE_USER_AGENT,
        }

        resp = requests.get(url, headers=headers)
        logging.debug('login resp: %s', resp.content)

        data = self.json_decode(resp.content)
        if data['status'] != 'ok' or not 'user_id' in data:
            return self.json_error(401, 'login failed')
        self.set_cookie('user_id', data['user_id'])

        cookie_str = resp.headers.get('Set-Cookie')
        if cookie_str:
            cookie = SimpleCookie()
            cookie.load(cookie_str)
            if settings.XIAMI_AUTH_COOKIE in cookie:
                auth_token = cookie.get(settings.XIAMI_AUTH_COOKIE).value
                self.set_cookie(settings.XIAMI_AUTH_COOKIE, auth_token)
        self.write(resp.body)


class APIProxyHandler(BaseHandler):
    def get(self, api_name):
        if not api_name in settings.API_URLS:
            return self.json_error(400, 'api unexist')

        try:
            url = settings.API_URLS[api_name] % self._single_value_arguments()
        except ValueError:
            return self.json_error(400, 'invalid arguments')
        logging.info('api url: %s', url)

        headers = {
            'User-Agent': settings.FAKE_USER_AGENT,
        }
        auth_token = self.get_cookie(settings.XIAMI_AUTH_COOKIE)
        if auth_token:
            cookie = SimpleCookie()
            cookie['member_auth'] = auth_token
            headers['Cookie'] = cookie.output().lstrip('Set-Cookie: ')

        resp = requests.get(url, headers=headers)
        logging.debug('api resp: %s', resp.content)
        self.write(resp.content)
        self.finish()


app.route_many([
    ('/', HomeHandler),
    ('/login', LoginHandler),
    ('/api_proxy/(\w+)', APIProxyHandler)
])


if __name__ == '__main__':
    import wsgiref.simple_server

    app.command_line_config()

    server = wsgiref.simple_server.make_server('', 7000, app.wsgi_application())
    server.serve_forever()
