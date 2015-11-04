/* global Sherd: true, console: true, getYouTubeID: true */
/* global YT: true */
/*
  Support for the YouTube js-enabled player.  documentation at:
  http://code.google.com/apis/youtube/js_api_reference.html
  http://code.google.com/apis/youtube/chromeless_example_1.html

  Signals:
  duration: signals duration change

  Listens For:
  seek: seek to a particular starttime
 */

if (!Sherd) {Sherd = {}; }
if (!Sherd.Video) {Sherd.Video = {}; }
if (!Sherd.Video.YouTube) {
    Sherd.Video.YouTube = function () {
        var self = this;

        Sherd.Video.Base.apply(this, arguments); //inherit -- video.js -- base.js

        this.presentations = {
            'small': {
                width: function () { return 320; },
                height: function () { return 240; }
            },
            'medium': {
                width: function () { return 480; },
                height: function () { return 360; }
            },
            'default': {
                width: function () { return 640; },
                height: function () { return 480; }
            }
        };

        ////////////////////////////////////////////////////////////////////////
        // Microformat

        // create == asset->{html+information to make it}
        this.microformat.create = function (obj) {
            var wrapperID = Sherd.Base.newID('youtube-wrapper-');
            self.playerID = Sherd.Base.newID('youtube_player_');
            var autoplay = obj.autoplay ? 1 : 0;
            self.media._ready = false;

            if (!obj.options) {
                var presentation;
                switch (typeof obj.presentation) {
                case 'string':
                    presentation = self.presentations[obj.presentation];
                    break;
                case 'object':
                    presentation = obj.presentation;
                    break;
                case 'undefined':
                    presentation = self.presentations['default'];
                    break;
                }

                obj.options = {
                    width: presentation.width(),
                    height: presentation.height()
                };
            }

            self.videoId = getYouTubeID(obj.youtube);
            var url = 'https://www.youtube.com/embed/' + self.videoId;
            var urlParams = jQuery.param({
                enablejsapi: 1,
                autoplay: autoplay,
                fs: 1,
                rel: 0,
                showinfo: 0,
                modestbranding: 1
            });
            return {
                object: obj,
                htmlID: wrapperID,
                playerID: self.playerID, // Used by microformat.components initialization
                autoplay: autoplay, // Used later by _seek seeking behavior
                mediaUrl: url, // Used by _seek seeking behavior
                text: '<div id="' + wrapperID + '" class="sherd-youtube-wrapper">' +
                    '<iframe type="text/html" ' +
                    'src="' + url + '?' + urlParams + '" ' +
                    'width="' + obj.options.width + '" ' +
                    'height="' + obj.options.height + '" ' +
                    'allowfullscreen="true" ' +
                    'frameborder="0" ' +
                    'id="' + self.playerID + '" />' +
                    '</div>'
            };
        };

        /**
         *  Access to the internal player and any options needed at runtime.
         *
         *  Returns a promise.
         */
        this.microformat.components = function (html_dom, create_obj) {
            var dfd = jQuery.Deferred();

            try {
                var rv = {};
                if (html_dom) {
                    rv.wrapper = html_dom;
                }

                if (create_obj) {
                    rv.player = document.getElementById(create_obj.playerID);
                    rv.autoplay = create_obj.autoplay;
                    rv.mediaUrl = create_obj.mediaUrl;
                    rv.playerID = create_obj.playerID;
                    rv.presentation = create_obj.object.presentation;
                    rv.itemId = create_obj.object.id;
                    rv.primaryType = create_obj.object.primary_type;

                    // Initialize the self.components.player object so we
                    // can control the video.
                    self.loadYouTubeAPI(create_obj.playerID).then(
                        function(player) {
                            // Set the player attribute on self.components,
                            // and also add the player to the return value
                            // that's used by base.js. It's kind of crazy but
                            // otherwise it doesn't work in the two cases:
                            // * Loading youtube video asset page directly.
                            // * Loading a new video after already viewing one.
                            self.components.player = player;
                            rv.player = player;
                            dfd.resolve(rv);
                        },
                        function(e) {
                            console.error('loadYouTubeAPI rejected.');
                        }
                    );
                } else {
                    return dfd.resolve(rv);
                }
                return dfd.promise();
            } catch (e) {
                return dfd.reject('error in microformat.components:', e);
            }
            return dfd.reject(false);
        };

        // Return asset object description (parameters) in a serialized JSON format.
        // NOTE: Not currently in use. Will be used for things like printing, or spitting out a description.
        this.microformat.read = function (found_obj) {
            var obj = {};
            var params = found_obj.html.getElementsByTagName('param');
            for (var i = 0; i < params.length; i++) {
                obj[params[i].getAttribute('name')] = params[i].getAttribute('value');
            }
            obj.mediaUrl = obj.movie;
            return obj;
        };

        // Note: not currently in use
        this.microformat.type = function () {
            return 'youtube';
        };

        // Replace the video identifier within the rendered .html
        this.microformat.update = function (obj, html_dom) {
            if (obj.youtube && document.getElementById(self.components.playerID) && self.media.ready()) {
                try {
                    return obj.youtube.indexOf(self.components.mediaUrl) === 0;
                }
                catch (e) {}
            }
            return false;
        };

        ////////////////////////////////////////////////////////////////////////
        // AssetView Overrides

        this.initialize = function (create_obj) {
            // register for notifications from clipstrip to seek to various times in the video
            self.events.connect(self, 'seek', self.media.playAt);

            self.events.connect(self, 'playclip', function (obj) {
                var opts = {};
                if (obj.hasOwnProperty('autoplay')) {
                    opts.autoplay = obj.autoplay;
                }
                self.setState(obj, opts);
                self.media.play();
            });
        };

        ////////////////////////////////////////////////////////////////////////
        // Media & Player Specific

        /**
         * Returns a promise that resolves with the YT.Player() instance.
         */
        this.loadYouTubeAPI = function(playerId) {
            var dfd = jQuery.Deferred();

            if (typeof YT === 'undefined' ||
                typeof YT.Player === 'undefined'
               ) {
                window.onYouTubeIframeAPIReady = function() {
                    var p = self.loadYouTubePlayer(playerId);
                    dfd.resolve(p);
                };

                jQuery.getScript('//www.youtube.com/iframe_api');
            } else {
                return dfd.resolve(self.loadYouTubePlayer(playerId));
            }

            return dfd.promise();
        };

        /**
         * Returns an instance of the YT.Player(), given the player's
         * html 'id', and the youtube videoId.
         */
        this.loadYouTubePlayer = function(playerId) {
            return new YT.Player(playerId, {
                events: {
                    'onReady': window.onPlayerReady,
                    'onStateChange': window.onPlayerStateChange
                }
            });
        };

        // Global function required for the player
        window.onPlayerReady = function() {
            if (decodeURI(self.playerID) === self.components.playerID) {
                self.media._ready = true;

                // Once the player is ready -- sort out any autoplay+seek requests
                if (self.components.starttime !== undefined) {
                    // Reseek if needed. Seek plays automatically
                    self.media.seek(self.components.starttime,
                                    self.components.endtime,
                                    self.components.autoplay);
                }
                if (self.components.autoplay) {
                    self.media.play();
                }
                self.components.starttime = undefined;
                self.components.endtime = undefined;
                self.components.autoplay = undefined;

                jQuery(window).trigger('video.create', [self.components.itemId, self.components.primaryType]);

                // register a state change function
                // @todo -- YouTube limitation does not allow anonymous functions. Will need to address for
                // multiple YT players on a page
                //self.player.addEventListener("onStateChange", 'onYTStateChange');
                // does not work self.player.addEventListener("onError", 'onYTError');
            } else {
                console.error(
                    'playerID mismatch:',
                    decodeURI(self.playerID),
                    self.components.playerID);
            }
        };

        // This event is fired whenever the player's state
        // changes. Possible values are unstarted (-1), ended (0),
        // playing (1), paused (2), buffering (3), video cued
        // (5). When the SWF is first loaded it will broadcast an
        // unstarted (-1) event.  When the video is cued and ready to
        // play it will broadcast a video cued event (5).
        //
        // @todo -- onYTStateChange does not pass the playerID into
        // the function, which will be a problem if we ever have
        // multiple players on the page
        window.onPlayerStateChange = function(newState) {
            switch (newState) {
            case 0: //ended
                self.events.clearTimers();
                jQuery(window).trigger(
                    'video.finish',
                    [self.components.itemId, self.components.primaryType]);
                break;
            case 1: // playing
                if (self.components.pauseit === true) {
                    self.media.pause();
                    self.components.pauseit = undefined;
                }
                var duration = self.media.duration();
                if (duration > 1) {
                    self.events.signal(self, 'duration', {duration: duration});
                    jQuery(window).trigger(
                        'video.play',
                        [self.components.itemId, self.components.primaryType]);
                }
                break;
            case 2: // stopped
                ///Do NOT clear timers here, because clicking 'play'
                ///cycles through a 2-state
                jQuery(window).trigger(
                    'video.pause',
                    [self.components.itemId, self.components.primaryType]);
                break;
            }
        };

        this.media.duration = function () {
            var duration = 0;
            if (self.components.player) {
                try {
                    duration = self.components.player.getDuration();
                    if (duration < 0) {
                        duration = 0;
                    }
                } catch (e) {
                    // media probably not yet initialized
                    console.error(e);
                }
            }
            return duration;
        };

        this.media.pause = function () {
            if (self.components.player) {
                try {
                    self.components.player.pauseVideo();
                } catch (e) {
                    console.error(e);
                }
            }
        };

        this.media.play = function () {
            if (self.components.player) {
                try {
                    self.components.player.playVideo();
                } catch (e) {
                    console.error(e);
                }
            }
        };

        this.media.ready = function () {
            return self.media._ready;
        };

        this.media.isPlaying = function () {
            var playing = false;
            try {
                playing = self.media.state() === 1;
            } catch (e) {
                console.error(e);
            }
            return playing;
        };

        this.media.seek = function (starttime, endtime, autoplay) {
            if (self.media.ready()) {
                if (typeof starttime !== 'undefined') {
                    if (self.components.player.seekTo) {
                        self.components.player.seekTo(starttime, true);
                        if (autoplay && !self.media.isPlaying()) {
                            self.media.play();
                        } else if (self.media.state() === -1) {
                            self.components.pauseit = true;
                        }
                    }
                }

                if (endtime) {
                    // Watch the video's running time & stop it when the endtime rolls around
                    // Delay the pause a few seconds. In an update situation, there can be a slight
                    // race condition between a prior seek with a greater end time. In that situation,
                    // the seek to the new time hasn't yet occurred and the pauseAt test (self.media.time > endtime)
                    // incorrectly returns true.
                    setTimeout(function () {
                        self.media.pauseAt(endtime);
                    }, 100);
                }
            } else {
                // store the values away for when the player is ready
                self.components.starttime = starttime;
                self.components.endtime = endtime;
                self.components.autoplay = autoplay;
            }
        };

        this.media.time = function () {
            var time = 0;
            if (self.components.player) {
                try {
                    time = self.components.player.getCurrentTime();
                    if (time < 0) {
                        time = 0;
                    }
                } catch (e) {
                    // media probably not yet initialized
                    console.error(e);
                }
            }
            return time;
        };

        this.media.timestrip = function () {
            var w = document.getElementById(self.playerID).width;
            return {
                w: w,
                trackX: 3,
                trackWidth: w - 2,
                visible: true
            };
        };

        // Used by tests. Might be nice to refactor state out so that
        // there's a consistent interpretation across controls
        this.media.state = function () {
            return self.components.player.getPlayerState();
        };

        this.media.url = function () {
            return self.components.player.getVideoUrl();
        };
    };
}
