/* global Sherd: true, ol: true */
if (!Sherd) { var Sherd = {}; }
if (!Sherd.Image) { Sherd.Image = {}; }
if (!Sherd.Image.Annotators) { Sherd.Image.Annotators = {}; }
if (!Sherd.Image.Annotators.OpenLayers) {
    Sherd.Image.Annotators.OpenLayers = function() {
        var self = this;

        Sherd.Base.AssetView.apply(this, arguments);//inherit

        this.source = new ol.source.Vector({wrapX: false});
        this.vectorLayer = new ol.layer.Vector({
            source: this.source
        });
        this.interaction = new ol.interaction.Draw({
            source: this.source,
            type: 'Polygon'
        });

        this.attachView = function (view) {
            self.targetview = view;
        };
        this.targetstorage = [];
        this.addStorage = function (stor) {
            this.targetstorage.push(stor);
        };

        this.getState = function () {
            return {};
        };

        this.setState = function (obj, options) {
           if (typeof obj === 'object') {
                //because only one annotation is allowed at once.
                ///At the moment, we could do a better job of saving 'all' features
                /// in an annotation rather than overwriting with the last one
                /// but then we run into confusion where people think they're making
                /// a lot of annotations, but really made one.

                if (options && options.mode && options.mode === "reset") {
                    self.openlayers.editingtoolbar = undefined;
                } else {
                    self.mode = null;
                    // options.mode == null||'create'||'browse'||'edit'||'copy'
                    if (self.openlayers.editingtoolbar) {
                        if (!options || !options.mode || options.mode === 'browse') {
                            // whole asset view. no annotations. or, just browsing
                            //self.openlayers.editingtoolbar.deactivate();
                            self.mode = "browse";
                            console.log('called deact');
                            if (typeof self.interaction !== 'undefined') {
                                console.log('removeInteraction');
                                /*self.targetview.openlayers.map.removeInteraction(
                                    self.interaction);*/
                            }
                        } else {
                            // create, edit, copy
                            //self.openlayers.editingtoolbar.activate();
                            self.mode = options.mode;
                            console.log('called act', typeof self.interaction);
                            if (typeof self.interaction !== 'undefined') {
                                console.log('adding interaction', self.interaction);
                                self.targetview.openlayers.map.addInteraction(
                                    self.interaction);
                            }
                        }
                    }
                }
            }
        };

        this.openlayers = {
            editingtoolbar: {}
        };

        this.deinitialize = function () {
            if (typeof self.interaction !== 'undefined') {
                console.log('removeInteraction');
                self.targetview.openlayers.map.removeInteraction(
                    self.interaction);
            }

            if (typeof self.vectorLayer !== 'undefined') {
                self.targetview.openlayers.map.removeLayer(
                    self.vectorLayer);
            }

            /*if (self.vectorLayer !== undefined &&
                    self.vectorLayer.id !==
                        self.targetview.openlayers.vectorLayer.getLayer().id) {
                self.openlayers.editingtoolbar = undefined;
            }*/
        };

        this.initialize = function (create_obj) {
            if (!self.openlayers.editingtoolbar) {
                self.vectorLayer =
                    self.targetview.openlayers.vectorLayer.getLayer();
                /*self.openlayers.editingtoolbar =
                    new self.openlayers.CustomEditingToolbar(self.vectorLayer);*/
                //self.targetview.openlayers.map.addControl(self.openlayers.editingtoolbar);

                self.targetview.openlayers.map.addLayer(this.vectorLayer);
                console.log('addInteraction');
                self.targetview.openlayers.map.addInteraction(self.interaction);
                self.openlayers.editingtoolbar = {};

                //self.openlayers.editingtoolbar.deactivate();

                //Q: this doubles mousewheel listening, e.g. why did we need it?
                //A: needed for not showing toolbar until clicking on an annotation
                //self.openlayers.editingtoolbar.sherd.navigation.activate();
                //Solution: just send signals or whatever.
                /*OpenLayers.Control.prototype.activate.call(
                        self.openlayers.editingtoolbar.sherd.navigation
                );*/
            }

            //on creation of an annotation
            self.openlayers.editingtoolbar.featureAdded = function (feature) {
                var current_state = self.targetview.getState();
                var geojson = self.targetview.openlayers.feature2json(feature);
                //copy feature properties to current_state
                for (var a in geojson) {
                    if (geojson.hasOwnProperty(a)) {
                        current_state[a] = geojson[a];
                    }
                }
                //use geojson object as annotation
                geojson.preserveCurrentFocus = true;
                self.targetview.setState(geojson);
                self.storage.update(current_state);
            };

            /// button listeners
            self.events.connect(self.components.center, 'click', function (evt) {
                self.targetview.setState({feature: self.targetview.currentfeature});
            });
        };

        this.storage = {
            'update': function (obj, just_downstream) {
                if (!just_downstream) {
                    self.setState(obj, { 'mode': self.mode });
                }
                for (var i = 0; i < self.targetstorage.length; i++) {
                    self.targetstorage[i].storage.update(obj);
                }
            }
        };

        this.microformat = {
            'create': function () {
                var id = Sherd.Base.newID('openlayers-annotator');
                return {
                    htmlID: id,
                    text: '<div id="' + id + '">' +
                    '<p style="display:none;" id="instructions" class="sherd-instructions">' +
                    'To create a selection of an image, choose a drawing tool, located on the upper, ' +
                    'right-hand side of the image. The polygon tool works by clicking on the points of ' +
                    'the polygon and then double-clicking the last point.<br /><br />' +
                    'Add title, tags and notes. If a Course Vocabulary has been enabled by ' +
                    'the instructor, apply vocabulary terms. Click Save when you are finished.' +
                    '</p></div>'
                };
            },
            'components': function (html_dom, create_obj) {
                return {
                    'top': html_dom,
                    'center': document.getElementById("btnCenter"),
                };
            }
        };
    };//END Sherd.Image.Annotators.OpenLayers
}//END if (!Sherd.Image.Annotators.OpenLayers)
