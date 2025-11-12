upload.load.need('js/download.js', function() { return upload.download })
upload.load.need('js/textpaste.js', function() { return upload.textpaste })
upload.load.need('js/loadencryption.js', function() { return window.crypt })
upload.load.need('js/updown.js', function() { return upload.updown })

upload.modules.addmodule({
    name: 'home',
    template: '\
        <div class="topbar">\
        <div class="viewswitcher">\
            <a id="newpaste" class="btn">Write a Memo</a>\
        </div>\
        </div>\
        <div class="contentarea" id="uploadview">\
            <div class="centerview">\
            <div id="pastearea" class="boxarea">\
                <h2>Add Your File</h2>\
                <h3>(∞ File Size Limit)</h3>\
            </div>\
            <div class="hidden boxarea" id="uploadprogress">\
                <h1 id="progresstype"></h1>\
                <h1 id="progressamount"></h1>\
                <div id="progressamountbg"></div>\
            </div>\
            <form>\
                <input type="file" id="filepicker" class="hidden" />\
            </form>\
            </div>\
        </div>\
        <div id="upload_password_modal_overlay" class="hidden modal password-modal-global">\
            <div class="boxarea password-card-global" id="passwordmodal_card">\
                <h2 class="password-title-global">Set a Password</h2>\
                <p style="margin-bottom: 25px; color: #eee; opacity: 0.8;">This password will be required to decrypt the file.</p>\
                <form id="passwordform" style="width: 100%;">\
                    <input type="password" id="passwordfield" placeholder="Enter password..." class="password-input-global" />\
                    <button type="submit" class="btn password-btn-global" id="upload_submit_btn">Encrypt & Upload</button>\
                    <button type="button" id="cancelupload" class="btn password-btn-global cancel-btn">Cancel</button>\
                    <div id="upload_password_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>\
                </form>\
            </div>\
        </div>\
        <div id="upload_face_modal_overlay" class="hidden modal password-modal-global">\
            <div class="boxarea password-card-global" id="face_modal_card">\
                <h2 class="password-title-global">Facial Recognition (2FA)</h2>\
                <p style="margin-bottom: 25px; color: #eee; opacity: 0.8;">Center your face in the camera to add 2FA.</p>\
                <div id="face_webcam_container">\
                    <video id="face_webcam" autoplay playsinline></video>\
                    <canvas id="face_canvas"></canvas>\
                    <div id="face_spinner" class="hidden"><div class="spinner"></div></div>\
                </div>\
                <button type="button" class="btn password-btn-global" id="capture_face_btn">Capture & Encrypt</button>\
                <button type="button" id="skip_face_btn" class="btn password-btn-global cancel-btn">Skip This Step</button>\
                <div id="face_modal_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>\
            </div>\
        </div>\
        ',
    init: function () {
        upload.modules.setdefault(this)
        $(document).on('change', '#filepicker', this.pickerchange.bind(this))
        $(document).on('click', '#pastearea', this.pickfile.bind(this))
        $(document).on('dragover', '#pastearea', this.dragover.bind(this))
        $(document).on('dragleave', '#pastearea', this.dragleave.bind(this))
        $(document).on('drop', '#pastearea', this.drop.bind(this))
        $(document).on('click', '#newpaste', this.newpaste.bind(this))
        $(document).on('click', this.triggerfocuspaste.bind(this))
        this.initpastecatcher()
        $(document).on('paste', this.pasted.bind(this))
        $(document).on('submit', '#passwordform', this.submitpassword.bind(this))
        $(document).on('click', '#cancelupload', this.cancelupload.bind(this))
        $(document).on('click', '#capture_face_btn', this.captureFace.bind(this))
        $(document).on('click', '#skip_face_btn', this.skipFace.bind(this))
        this.state = {};
    },
    dragleave: function (e) {
        e.preventDefault()
        e.stopPropagation()
        this._.pastearea.removeClass('dragover')
    },
    drop: function (e) {
        e.preventDefault()
        this._.pastearea.removeClass('dragover')
        if (e.dataTransfer.files.length > 0) {
            this.doupload(e.dataTransfer.files[0])
        }
    },
    dragover: function (e) {
        e.preventDefault()
        this._.pastearea.addClass('dragover')
    },
    pickfile: function(e) {
        this._.filepicker.click()
    },
    pickerchange: function(e) {
        if (e.target.files.length > 0) {
            this.doupload(e.target.files[0])
            $(e.target).parents('form')[0].reset()
        }
    },
    route: function (route, content) {
        if (content && content != 'noref') {
            return upload.download
        }
        return this
    },
    render: function (view) {
        view.html(this.template)
        this._ = {}
        this._.view = view
        this._.filepicker = view.find('#filepicker')
        this._.pastearea = view.find('#pastearea')
        this._.newpaste = view.find('#newpaste')
        this._.progress = {}
        this._.progress.main = view.find('#uploadprogress')
        this._.progress.type = view.find('#progresstype')
        this._.progress.amount = view.find('#progressamount')
        this._.progress.bg = view.find('#progressamountbg')
        this._.passwordmodal = view.find('#upload_password_modal_overlay')
        this._.passwordfield = view.find('#passwordfield')
        this._.uploadview = view.find('#uploadview')
        this._.uploadErrorMsg = view.find('#upload_password_error_msg')
        this._.passwordCard = view.find('#passwordmodal_card')
        this._.facemodal = view.find('#upload_face_modal_overlay')
        this._.faceCard = view.find('#face_modal_card')
        this._.faceWebcam = view.find('#face_webcam')[0]
        this._.faceCanvas = view.find('#face_canvas')[0]
        this._.faceSpinner = view.find('#face_spinner')
        this._.faceErrorMsg = view.find('#face_modal_error_msg')
        this.webcam = new Webcam(this._.faceWebcam, 'user', this._.faceCanvas);
        $('#footer').show()
    },
    initroute: function () {
        this.focuspaste()
    },
    unrender: function() {
        if (this.webcam) {
            this.webcam.stop();
        }
        delete this['_']
    },
    initpastecatcher: function () {
        this.pastecatcher = $('<pre>').prop('id', 'pastecatcher')
        this.pastecatcher.prop('contenteditable', true)
        $('body').append(this.pastecatcher)
    },
    focuspaste: function () {
        setTimeout(function () {
            this.pastecatcher.focus()
        }, 100)
    },
    triggerfocuspaste: function(e) {
        if (e.which != 1) {
            return
        }
        if (e.target == document.body && this._ && !this._.pastearea.hasClass('hidden')) {
            e.preventDefault()
            this.focuspaste()
        }
    },
    progress: function(e) {
        if (e.eventsource != 'encrypt') {
            this._.progress.type.text('Creating Locker')
        } else {
            this._.progress.type.text('Encrypting Locker')
        }
        var percent = (e.loaded / e.total) * 100
        this._.progress.bg.css('width', percent + '%')
        this._.progress.amount.text(Math.floor(percent) + '%')
    },
    doupload: function (blob) {
        this._.uploadblob = blob;
        this._.uploadview.addClass('hidden');
        this._.passwordmodal.removeClass('hidden');
        this._.passwordfield.focus();
        this._.uploadErrorMsg.text('');
        this.state = {};
        anime.remove(this._.passwordCard[0]);
        anime({
            targets: this._.passwordCard[0],
            scale: [0.9, 1],
            opacity: [0, 1],
            duration: 400,
            easing: 'easeOutQuad'
        });
    },
    cancelupload: function() {
        var self = this;
        anime({
            targets: self._.passwordCard[0],
            scale: [1, 0.9],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInQuad',
            complete: function() {
                self._.uploadblob = null;
                self._.passwordmodal.addClass('hidden');
                self._.passwordfield.val('');
                self._.uploadview.removeClass('hidden');
            }
        });
    },
    submitpassword: function(e) {
        e.preventDefault();
        var self = this;
        var password = this._.passwordfield.val();
        if (!password) {
            this._.uploadErrorMsg.text("Please enter a password.");
            anime.remove(self._.passwordCard[0]);
            anime({
                targets: self._.passwordCard[0],
                translateX: [-10, 10, -10, 10, 0],
                duration: 300,
                easing: 'easeInOutSine'
            });
            return;
        }
        this.state.password = password;
        anime({
            targets: self._.passwordCard[0],
            scale: [1, 0.9],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInQuad',
            complete: function() {
                self._.passwordmodal.addClass('hidden');
                self._.passwordfield.val('');
                self._.uploadErrorMsg.text('');
                self.startFaceModal();
            }
        });
    },
    startFaceModal: function() {
        var self = this;
        this._.facemodal.removeClass('hidden');
        this._.faceSpinner.addClass('hidden');
        this._.faceErrorMsg.text('');
        anime.remove(this._.faceCard[0]);
        anime({
            targets: this._.faceCard[0],
            scale: [0.9, 1],
            opacity: [0, 1],
            duration: 400,
            easing: 'easeOutQuad'
        });
        this.webcam.start()
            .then(function(result) {
                console.log("Webcam started");
            })
            .catch(function(err) {
                console.error("Error starting webcam:", err);
                self._.faceErrorMsg.text("Could not start webcam. Please allow camera access.");
            });
    },
    captureFace: function() {
        var self = this;
        var faceDataUri = this.webcam.snap();
        if (!faceDataUri) {
            this._.faceErrorMsg.text("Failed to capture image. Please try again.");
            return;
        }
        this._.faceSpinner.removeClass('hidden');
        this._.faceErrorMsg.text('');
        $.get('/public_key')
            .done(function(keyData) {
                self.encryptAndUpload(faceDataUri, keyData.key);
            })
            .fail(function() {
                self._.faceSpinner.addClass('hidden');
                self._.faceErrorMsg.text("Error: Could not contact server to get public key.");
            });
    },
    encryptAndUpload: function(faceDataUri, pubKeyBase64) {
        var self = this;
        crypt.encryptFace(pubKeyBase64, faceDataUri)
            .done(function(result) {
                self.startUpload(result.encryptedFace);
            })
            .fail(function(err) {
                console.error("Face encryption failed:", err);
                self._.faceSpinner.addClass('hidden');
                self._.faceErrorMsg.text("A crypto error occurred during face encryption.");
            });
    },
    skipFace: function() {
        var self = this;
        this.webcam.stop();
        anime({
            targets: self._.faceCard[0],
            scale: [1, 0.9],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInQuad',
            complete: function() {
                self._.facemodal.addClass('hidden');
                self.startUpload(null); 
            }
        });
    },
    startUpload: function(encryptedFaceData) {
        var self = this;
        this.webcam.stop();
        if (!this._.facemodal.hasClass('hidden')) {
            anime({
                targets: self._.faceCard[0],
                scale: [1, 0.9],
                opacity: [1, 0],
                duration: 300,
                easing: 'easeInQuad',
                complete: function() {
                    self._.facemodal.addClass('hidden');
                    self.showProgressAndUpload(encryptedFaceData);
                }
            });
        } else {
            self.showProgressAndUpload(encryptedFaceData);
        }
    },
    showProgressAndUpload: function(encryptedFaceData) {
        this._.pastearea.addClass('hidden');
        this._.progress.main.removeClass('hidden');
        this._.progress.type.text('Encrypting Locker');
        this._.progress.bg.css('width', 0);
        this._.newpaste.addClass('hidden');
        upload.updown.upload(
            this._.uploadblob, 
            this.progress.bind(this), 
            this.uploaded.bind(this), 
            this.state.password, 
            encryptedFaceData
        );
        this._.uploadblob = null;
        this.state = {};
    },
    closepaste: function() {
      this._.pastearea.removeClass('hidden')
      this._.view.find('#uploadview').show()
      this._.view.find('.viewswitcher').show()
    },
    dopasteupload: function (data) {
        this._.pastearea.addClass('hidden')
        this._.view.find('#uploadview').hide()
        this._.view.find('.viewswitcher').hide()
        upload.textpaste.render(this._.view, 'Untitled-Memo.txt', data, 'text/plain', this.closepaste.bind(this))
    },
    uploaded: function (data, response) {
        upload.download.delkeys[data.ident] = response.delkey
        try {
            localStorage.setItem('delete-' + data.ident, response.delkey)
        } catch (e) {
            console.log(e)
        }
        if (window.location.hash == '#noref') {
            history.replaceState(undefined, undefined, '#' + data.seed)
            upload.route.setroute(upload.download, undefined, data.seed)
        } else {
            window.location = '#' + data.seed
        }
    },
    newpaste: function() {
        this.dopasteupload('')
    },
    pasted: function (e) {
        if (!this._ || this._.pastearea.hasClass('hidden') || !this._.uploadview.is(':visible')) {
            return;
        }
        var items = e.clipboardData.items
        var text = e.clipboardData.getData('text/plain')
        if (text) {
            e.preventDefault()
            this.dopasteupload(text)
        } else if (typeof items == 'undefined') {
            self = this
            setTimeout(function () {
                if (self.pastecatcher.find('img').length) {
                    var src = self.pastecatcher.find('img').prop('src')
                    if (src.startsWith('data:')) {
                        self.doupload(dataURItoBlob(src))
                    } else {
                    }
                }
            }, 0)
        } else if (items.length >= 1) {
            e.preventDefault()
            for (var i = 0; i < items.length; i++) {
                var blob = items[i].getAsFile()
                if (blob) {
                    this.doupload(blob)
                    break
                }
            }
        }
    },
})