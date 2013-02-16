#!/usr/bin/env python
# -*- coding: utf-8 -*-

from torext.handlers import BaseHandler as _BaseHandler


class BaseHandler(_BaseHandler):
    def json_error(self, status_code, msg):
        self.set_status(status_code)
        self.write({'error': msg})
        self.finish()

    def _single_value_arguments(self):
        return dict((k, v[0]) for k, v in self.request.arguments.iteritems())


class HomeHandler(BaseHandler):
    def get(self):
        self.render('home.html', user_id=self.get_argument('user_id', None))
