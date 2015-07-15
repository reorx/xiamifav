#!/usr/bin/env python
# -*- coding: utf-8 -*-


import os
import logging
import tornado.web
from tornado.options import define, options
import tornado.ioloop
import tornado.log
import tornado.escape
from tornado.httpclient import AsyncHTTPClient
from Cookie import SimpleCookie

import settings
from base import BaseHandler, HomeHandler


define('debug', default='False')


class LoginHandler(BaseHandler):
    URL = 'http://www.xiami.com/app/iphone/login/email/%(email)s/pwd/%(password)s'

    @tornado.web.asynchronous
    def post(self):
        try:
            url = self.URL % self._single_value_arguments()
        except ValueError:
            return self.json_error(400, 'invalid arguments')

        headers = {
            'User-Agent': settings.FAKE_USER_AGENT,
        }

        client = AsyncHTTPClient()
        client.fetch(url, self._on_api_response, headers=headers)

    def _on_api_response(self, resp):
        logging.debug('login resp: %s', resp.body)

        data = tornado.escape.json_decode(resp.body)
        if data['status'] != 'ok' or not 'user_id' in data:
            self.json_error(401, 'login failed')
            return

        cookie_str = resp.headers.get('Set-Cookie')
        if cookie_str:
            cookie = SimpleCookie()
            cookie.load(cookie_str)
            if settings.XIAMI_AUTH_COOKIE in cookie:
                auth_token = cookie.get(settings.XIAMI_AUTH_COOKIE).value
                self.set_cookie(settings.XIAMI_AUTH_COOKIE, auth_token, expires_days=7)
        self.set_cookie('user_id', str(data['user_id']), expires_days=7)
        self.write(resp.body)
        self.finish()


class APIProxyHandler(BaseHandler):
    @tornado.web.asynchronous
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

        client = AsyncHTTPClient()
        client.fetch(url, self._on_api_response, headers=headers)

    def _on_api_response(self, resp):
        logging.debug('api resp: %s', resp.body)
        self.write(resp.body)
        self.finish()


def make_application(debug=False):
    application = tornado.web.Application(
        [
            ('/', HomeHandler),
            ('/login', LoginHandler),
            ('/api_proxy/(\w+)', APIProxyHandler),
        ],
        template_path=settings.TEMPLATE_PATH,
        static_path=settings.STATIC_PATH,
        debug=debug)
    return application


if __name__ == '__main__':
    logging.getLogger().setLevel(logging.INFO)
    tornado.log.enable_pretty_logging()

    tornado.options.parse_command_line()
    if options.debug == 'True':
        debug = True
    else:
        debug = False
    logging.info('debug: %s', debug)
    application = make_application(debug)

    port = os.getenv('PORT', 7000)
    logging.info('port: %s', port)
    application.listen(port)

    tornado.ioloop.IOLoop.instance().start()
