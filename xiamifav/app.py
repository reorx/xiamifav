#!/usr/bin/env python
# -*- coding: utf-8 -*-

import logging
from Cookie import SimpleCookie
from torext.app import TorextApp
import settings
from torext.handlers import BaseHandler as _BaseHandler
from tornado.web import asynchronous
from tornado.httpclient import AsyncHTTPClient, HTTPClient


app = TorextApp(settings)
app.setup()

API_URLS = {
    'fav_songs': 'http://api.xiami.com/app/android/lib-songs?uid=%(uid)s&page=%(page)s',
}

FAKE_USER_AGENT = 'Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'

XIAMI_AUTH_COOKIE = 'member_auth'


class BaseHandler(_BaseHandler):
    def json_error(self, status_code, msg):
        self.set_status(status_code)
        self.write({'error': msg})
        self.finish()

    def _single_value_arguments(self):
        return dict((k, v[0]) for k, v in self.request.arguments.iteritems())


@app.route('/')
class HomeHandler(BaseHandler):
    def get(self):
        self.render('home.html', user_id=self.get_argument('user_id', None))


@app.route('/login')
class LoginHandler(BaseHandler):
    URL = 'http://www.xiami.com/app/iphone/login/email/%(email)s/pwd/%(password)s'

    def post(self):
        try:
            url = self.URL % self._single_value_arguments()
        except ValueError:
            return self.json_error(400, 'invalid arguments')

        headers = {
            'User-Agent': FAKE_USER_AGENT,
        }

        client = HTTPClient()
        resp = client.fetch(url, headers=headers)
        logging.debug('login resp: %s', resp.body)

        data = self.json_decode(resp.body)
        if data['status'] != 'ok' or not 'user_id' in data:
            return self.json_error(401, 'login failed')
        self.set_cookie('user_id', data['user_id'])

        cookie_str = resp.headers.get('Set-Cookie')
        if cookie_str:
            cookie = SimpleCookie()
            cookie.load(cookie_str)
            if XIAMI_AUTH_COOKIE in cookie:
                auth_token = cookie.get(XIAMI_AUTH_COOKIE).value
                self.set_cookie(XIAMI_AUTH_COOKIE, auth_token)
        self.write(resp.body)


@app.route('/api_proxy/(\w+)')
class APIProxyHandler(BaseHandler):
    @asynchronous
    def get(self, api_name):
        if not api_name in API_URLS:
            return self.json_error(400, 'api unexist')

        try:
            url = API_URLS[api_name] % self._single_value_arguments()
        except ValueError:
            return self.json_error(400, 'invalid arguments')
        logging.info('api url: %s', url)

        headers = {
            'User-Agent': FAKE_USER_AGENT,
        }
        auth_token = self.get_cookie(XIAMI_AUTH_COOKIE)
        if auth_token:
            cookie = SimpleCookie()
            cookie['member_auth'] = auth_token
            headers['Cookie'] = cookie.output().lstrip('Set-Cookie: ')

        client = AsyncHTTPClient()
        client.fetch(url, self._on_api_response, headers=headers)

    def _on_api_response(self, resp):
        logging.debug('api resp: %s', resp.body)
        self.write(resp.body)
        self.finish()

if __name__ == '__main__':

    app.command_line_config()
    app.run()
