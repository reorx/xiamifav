$(function() {
    Backbone.sync = function(opts, model) {
        console.log('now sync', opts, model)
    }

    var PlayerView = Backbone.View.extend({
        initialize: function() {
            this.$core = $('iframe._player').contents().find('body');
            this.$core.append($('<audio>').addClass('now'))
                .append($('<audio>').addClass('next'));
            this.$now = this.$core.find('.now');
            this.now = this.$now.get(0);
        },
        play: function(url) {
            this.now.src = url;
            this.now.load();
            this.now.play();
        },
        pause: function() {
            this.now.pause();
        },
    });
    Player = new PlayerView();

    var Song = Backbone.Model.extend({
    });
    var SongCollection = Backbone.Collection.extend({
        model: Song,
        initialize: function(args) {
            this.user_id = args.user_id;
            this.page = 0;
        },
        fetchPage: function() {
            console.log('fetch page, uid', this.user_id, ', page', this.page + 1);
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
                        $('.playlist').after($('<div class="nosongs">no songs</div>'));
                        return;
                    }
                    data.songs.forEach(function(songData) {
                        song = new _this.model(songData);
                        _this.add(song);
                    });
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
        },
        playNext: function() {
            if (!this.next) {
                console.log('still no next, loading');
                App.Songs.fetchPage($.proxy(this.playNext));
                return;
            }
            this.next.play();
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
            'click .control .logout': 'logout',
        },
        initialize: function() {
            var _this = this;

            // extra event binding
            var logoutButton = this.$el.find('.control .logout a');
            bindTap(logoutButton, 'logoutButton', function() {
                logoutButton.addClass('active');
            }, function() {
                logoutButton.removeClass('active');
            });

            $(window).bind('scroll', function() {
                console.log('scroll');
                if($(document).height() == $(window).scrollTop() + $(window).height()){
                    console.log('scroll to end');
                    _this.Songs.fetchPage();
                }
            })

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
            })
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
                this.Songs = new SongCollection({user_id: this.user_id});
                this.listenTo(this.Songs, 'add', this.addSong);
                // data fetching and app rendering now starts
                this.Songs.fetchPage();
                $('.playlist-wrapper').fadeIn(300, function() {
                    if (callback) callback();
                });
            } else {
                $('.playlist-wrapper').fadeOut(300, function() {
                    $('.playlist').empty();
                    $('.nosongs').remove();
                    delete _this.Songs;
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
        logoutLight: function(e) {
        },
        addSong: function(song) {
            var view = new SongView({model: song});
            if (this.lastSongView) {
                this.lastSongView.set_next(view);
            }
            this.lastSongView = view;
            this.$el.find('.playlist').append(view.el);
        },
    });

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

    var App = new AppView();

});
