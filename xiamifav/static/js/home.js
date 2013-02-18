$(function() {

    function bindTap(target, name, onTapFn, endTapFn) {
        var onEvents = 'mousedown.' + name + ' ' +
            'touchstart.' + name;
        var endEvents= 'mousemove.' + name + ' ' +
            'mouseup.' + name + ' ' +
            'touchmove.' + name + ' ' +
            'touchend.' + name;
        //console.log(onEvents, endEvents);

        target.bind(onEvents, function() {
            console.log('on tap');
            onTapFn();
            $(document).bind(endEvents, function() {
                $(document).unbind(endEvents);
                endTapFn();
            });
        })
    }
    Backbone.sync = function(opts, model) {
        alert('Backbone.sync was called, which is unexpected to happen');
    }

    var PlayerView = Backbone.View.extend({
        el: '.control',
        events: {
            'click .play': 'operatePlay',
            'click .prev': 'operatePrev',
            'click .next': 'operateNext',
            //'click .nav-wrapper .toggler': 'toggleNav',
            'click .nav .logout': 'logout',
        },
        initialize: function() {
            console.log('init');
            this.$core = $('#_player').contents().find('body');
            this.$core.append($('<audio>').attr('type', 'audio/mp3').addClass('now'))
                .append($('<audio>').addClass('next'));
            this.$now = this.$core.find('.now');
            this.now = this.$now.get(0);
            this.playingView = undefined;

            this.$el.find('.core a').each(function() {
                var $this = $(this);
                bindTap($this, 'controlButton', function() {
                    $this.addClass('active');
                }, function() {
                    $this.removeClass('active');
                })
            });

            var _this = this;
                toggler = this.$el.find('.nav-wrapper .toggler'),
                nav = this.$el.find('.nav'),
                showAndBind = function() {
                    toggler.addClass('opened');
                    toggler.unbind('click');
                    nav.show(function() {
                        $(document).bind('click.hideNav', function() {
                            toggler.removeClass('opened');
                            $(document).unbind('click.hideNav');
                            nav.hide(function() {
                                toggler.bind('click', showAndBind);
                            })
                        });
                    })
                };
            toggler.bind('click', showAndBind);
        },
        play: function(url) {
            this.now.src = url;
            this.now.load();
            this.now.play();
        },
        pause: function() {
            this.now.pause();
        },
        toggleNav: function() {
            var nav = this.$el.find('.nav');
            if (nav.is(':visible')) {
                nav.hide();
            } else {
                nav.show();
            }
        },
        operatePlay: function(e) {
            var _this = this;
            if (this.now.src) {
                if (this.now.paused) {
                    this.now.play();
                    this.switchPlayButton(true);
                } else {
                    this.now.pause();
                    this.switchPlayButton(false);
                }
            }
            if (e)
                e.preventDefault();
        },
        switchPlayButton: function(tf) {
            if (tf) {
                this.$el.find('.play').addClass('playing')
            } else {
                this.$el.find('.play').removeClass('playing')
            }
        },
        operatePrev: function(e) {
            if (this.playingView) {
                this.playingView.playPrev();
            }
            if (e)
                e.preventDefault();
        },
        operateNext: function(e) {
            if (this.playingView) {
                this.playingView.playNext();
            }
            if (e)
                e.preventDefault();
        },
        logout: function() {
            App.logout();
        }
    });
    Player = new PlayerView();

    var Song = Backbone.Model.extend({
        titleArtist: function() {
            return this.get('name') + ' - ' + this.get('artist_name');
        }
    });
    var SongCollection = Backbone.Collection.extend({
        model: Song,
        initialize: function(args) {
            this.user_id = args.user_id;
            this.page = 0;
            this.retries = 0;
            this.maxRetries = 3;
        },
        fetchPage: function() {
            console.log('fetch page, uid', this.user_id, ', page', this.page + 1);
            this.trigger('fetching');

            var _this = this;
            $.getJSON(
                '/api_proxy/fav_songs',
                {
                    'uid': this.user_id,
                    'page': ++this.page
                },
                function(data) {
                    console.log('/fav_songs response', data);

                    if (!data || !data.songs) {
                        _this.retries += 1;
                        if (_this.retries >= _this.maxRetries)
                            _this.trigger('fetchAbandoned');
                        else
                            _this.trigger('fetchFailed');
                        return;
                    }
                    data.songs.forEach(function(songData) {
                        song = new _this.model(songData);
                        _this.add(song);
                    });
                    _this.trigger('fetched');
                }
            );
        }
    });
    var SongView = Backbone.View.extend({
        tagName: 'li',
        template: _.template($('#template-song').html()),
        events: {
            'click': 'play',
        },
        initialize: function() {
            this.next = undefined;
            this.prev = undefined;
            this.render();

            // extra events
            var $song = this.$el
            bindTap($song, 'songItem', function() {
                $song.addClass('active');
            }, function() {
                $song.removeClass('active');
            })
        },
        set_next: function(next) {
            this.next = next;
        },
        set_prev: function(prev) {
            this.prev = prev;
        },
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        },
        play: function() {
            if (!this.next) {
                console.log('no next, pre-loading');
                App.Songs.fetchPage();
            } else {
                console.log('next is', this.next.model.get('name'));
            }

            if (Player.playingView) {
                Player.playingView.stop();
            }
            Player.playingView = this;

            var _this = this;
            Player.$now.unbind('timeupdate');
            Player.$now.bind('timeupdate', function() {
                // change progress
                _this.$el.find('.progress').css('width', 100 * this.currentTime / this.duration + '%');

                // change time status
                var minute = Math.floor(this.currentTime / 60),
                    second = Math.floor(this.currentTime - minute * 60);
                //console.log('time', minute, second);
                if (minute < 10)
                    minute = '0' + minute
                if (second < 10)
                    second = '0' + second
                _this.status(minute + ':' + second);
            });

            Player.$now.unbind('ended');
            Player.$now.bind('ended', function() {
                _this.playNext();
            })

            Player.play(this.model.get('location'));
            $('title').html('XiamiFav: ' + this.model.titleArtist());
            Player.switchPlayButton(true);
        },
        playNext: function() {
            if (!this.next) {
                console.log('still no next, loading');
                App.Songs.fetchPage($.proxy(this.playNext));
                return;
            }
            this.next.play();
        },
        playPrev: function() {
            if (this.prev)
                this.prev.play();
        },
        stop: function() {
            this.$el.find('.progress').css('width', '0%');
            this.status();
        },
        status: function(timeString) {
            if (timeString) {
                this.$el.find('.status').html(timeString);
            } else {
                this.$el.find('.status').html('');
            }
        },
    });
    /* app is the playlist */
    var AppView = Backbone.View.extend({
        el: 'body',
        events: {
            'click .login .toggler': 'toggleLoginArea',
            'submit .user_id_area': 'idLogin',
            'submit .userinfo_area': 'infoLogin',
        },
        initialize: function() {
            var _this = this;

            // extra event binding
            var logoutButton = this.$el.find('.nav .logout a');
            bindTap(logoutButton, 'logoutButton', function() {
                logoutButton.addClass('active');
            }, function() {
                logoutButton.removeClass('active');
            });

            // jquery elements
            this.notice = this.$el.find('.loading_notice');

            this.user_id = $.cookie('user_id');
            $('.loading').fadeOut(300, function() {
                if (!_this.user_id) {
                    _this.togglePlaylist(false, function() {
                        _this.toggleLogin(true);
                    });
                } else {
                    _this.toggleLogin(false, function() {
                        _this.togglePlaylist(true);
                    });
                }
            });
        },
        fixControlPosition: function() {
            var control = $('.control');
            console.log('control', control.eq(0), control.width(), control.height());
            $('.control-wrapper').css({'width': control.outerWidth(), 'height': control.outerHeight()});
            control.css({'width': control.width(), 'height': control.height(), 'position': 'fixed'}, function() {
            });
        },
        initPlaylist: function() {
            this.Songs = new SongCollection({user_id: this.user_id});
            this.listenTo(this.Songs, 'add', this.addSong);
            this.listenTo(this.Songs, 'fetching', _.partial(this.onFetching));
            this.listenTo(this.Songs, 'fetched', _.partial(this.onFetched));
            this.listenTo(this.Songs, 'fetchFailed', _.partial(this.onFetchFailed));
            this.listenTo(this.Songs, 'fetchAbandoned', _.partial(this.onFetchAbandoned));

            // data fetching and app rendering now starts
            this.Songs.fetchPage();

            // ui events
            /*
            $(document).bind('scroll.control', function() {
                console.log('scrolled');
                App.fixControlPosition();
                $(document).unbind('scroll.control');
            });
            */
            $(window).bind('keydown', function(e) {
                if (e.keyCode == 32) {
                    Player.operatePlay();
                    e.preventDefault();
                }
            });

        },
        bindScroll: function() {
            var _this = this;
            $(window).bind('scroll.fetch', function() {
                //alert('scrolled ' + $(document).height() + '|' + ($(window).scrollTop() + $(window).height() + 1));
                // Plus 1 fix for ipad (dont konw why)
                if($(document).height() <= $(window).scrollTop() + $(window).height() + 1){
                    console.log('scrolled to end');
                    _this.Songs.fetchPage();
                }
            });
        },
        unbindScroll: function() {
            $(window).unbind('scroll.fetch');
        },
        onFetching: function() {
            console.log('fetching');
            this.unbindScroll();
            //this.fetchNotice('fetching');
            this.notice.html('fetching').stop(true, true).slideDown(0, function() {
                $("html, body").animate({ scrollTop: $(document).height() - 1 }, 0);
            });
        },
        onFetched: function() {
            var _this = this;
            this.notice.html('').stop(true, true).slideUp(0, function() {
                _this.bindScroll();
            });
        },
        onFetchFailed: function() {
            //this.fetchNotice('no songs');
            //this.bindScroll();
            this.notice.html('no songs');
            this.bindScroll();
        },
        onFetchAbandoned: function() {
            this.notice.html('really, really no songs');
        },
        fetchNotice: function(s) {
            var notice = this.$el.find('.loading_notice');
            var scrollToBottom = function() {
                $("html, body").animate({ scrollTop: $(document).height() - 1 }, 300);
            }
            if (!s) {
                console.log('no message');
                notice.html('').stop(true, true).slideUp(500);
            } else {
                notice.html(s).stop(true, true).slideDown(500, function() {
                    scrollToBottom();
                });
            }
        },
        clearPlaylist: function() {
            $('.playlist').empty();
            delete this.Songs;
        },
        toggleLogin: function(tf, callback) {
            if (tf) {
                $('.login').fadeIn(300, function() {
                    if (callback) callback();
                });
            } else {
                $('.login').fadeOut(300, function() {
                    if (callback) callback();
                });
            }
        },
        togglePlaylist: function(tf, callback) {
            var _this = this;
            if (tf) {
                _this.initPlaylist();
                $('.playlist-wrapper').fadeIn(300, function() {
                    if (callback) callback();
                });
            } else {
                $('.playlist-wrapper').fadeOut(300, function() {
                    _this.clearPlaylist();
                    if (callback) callback();
                });
            }
        },
        toggleLoginArea: function() {
            var $user_id = $('.login .user_id_area'),
                $userinfo = $('.login .userinfo_area');
            if ($user_id.hasClass('active')) {
                $('.login .toggler').addClass('red');
                $user_id.removeClass('active');
                $userinfo.addClass('active');
                $user_id.fadeOut(300, function() {
                    $userinfo.fadeIn();
                });
            } else {
                $('.login .toggler').removeClass('red');
                $userinfo.removeClass('active');
                $user_id.addClass('active');
                $userinfo.fadeOut(300, function() {
                    $user_id.fadeIn();
                });
            }
        },
        idLogin: function(e) {
            e.preventDefault();

            var _this = this,
                $form = $(e.currentTarget);
            // check form (for mobile device)
            if (!$form[0].checkValidity()) {
                $form.find('input').eq(0).focus();
                return false;
            }

            this.afterLogin($form.find('input[name="user_id"]').val())
            return false;
        },
        infoLogin: function(e) {
            e.preventDefault();

            var _this = this,
                $form = $(e.currentTarget);
            // check form (for mobile device)
            if (!$form[0].checkValidity()) {
                $form.find('input').eq(0).focus();
                return false;
            }

            console.log('valid');
            $.ajax({
                type: 'POST',
                url: '/login',
                data: $form.serialize(),
                success: function(json) {
                    var data = $.parseJSON(json);
                    _this.afterLogin(data.user_id);
                }
            });
            return false;
        },
        afterLogin: function(user_id) {
            this.user_id = user_id;
            $.cookie('user_id', user_id);

            var _this = this;
            _this.toggleLogin(false, function() {
                _this.togglePlaylist(true);
            });
        },
        logout: function() {
            if (Player.playingView)
                Player.playingView.stop();
            $.removeCookie('user_id');
            this.user_id = undefined;
            var _this = this;
            // clear values
            $('.login').find('input[type="text"], input[type="password"]').val('');

            _this.togglePlaylist(false, function() {
                _this.toggleLogin(true);
            });
        },
        addSong: function(song) {
            var view = new SongView({model: song});
            if (this.lastSongView) {
                this.lastSongView.set_next(view);
                view.set_prev(this.lastSongView);
            }
            this.lastSongView = view;
            this.$el.find('.playlist').append(view.el);
        },
        onKeydown: function(e) {
        }
    });

    App = new AppView();


});
