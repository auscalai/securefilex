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
        <div id="expiry_modal_overlay" class="hidden modal password-modal-global">\
            <div class="boxarea password-card-global" id="expiry_modal_card">\
                <h2 class="password-title-global">Set File Expiration</h2>\
                <p style="margin-bottom: 25px; color: #eee; opacity: 0.8;">The file will be permanently deleted after this time.</p>\
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">\
                    <input type="number" id="expiry_value" placeholder="24" min="1" class="password-input-global" style="width: 100px; text-align: center; margin-right: 10px;" />\
                    <select id="expiry_unit" class="password-input-global" style="width: 150px;">\
                        <option value="hours" selected>Hours</option>\
                        <option value="days">Days</option>\
                    </select>\
                </div>\
                <button type="button" class="btn password-btn-global" id="continue_from_expiry">Continue</button>\
                <button type="button" id="cancel_upload_start" class="btn password-btn-global cancel-btn">Cancel</button>\
                <div id="expiry_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>\
            </div>\
        </div>\
        <div id="upload_password_modal_overlay" class="hidden modal password-modal-global">\
            <div class="boxarea password-card-global" id="passwordmodal_card">\
                <h2 class="password-title-global">Set a Password</h2>\
                <p style="margin-bottom: 25px; color: #eee; opacity: 0.8;">This password will be required to decrypt the file.</p>\
                <form id="passwordform" style="width: 100%;">\
                    <input type="password" id="passwordfield" placeholder="Enter password..." class="password-input-global" />\
                    <button type="submit" class="btn password-btn-global" id="upload_submit_btn">Continue</button>\
                    <button type="button" id="back_to_expiry" class="btn password-btn-global cancel-btn">Back</button>\
                    <div id="upload_password_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>\
                </form>\
            </div>\
        </div>\
        <div id="twofa_choice_modal_overlay" class="hidden modal password-modal-global">\
            <div class="boxarea password-card-global" id="twofa_choice_card">\
                <h2 class="password-title-global">Choose 2FA Method (Optional)</h2>\
                <p style="margin-bottom: 25px; color: #eee; opacity: 0.8;">Add an extra layer of security to your file.</p>\
                <button type="button" class="btn password-btn-global" id="choose_face_btn">Facial Recognition</button>\
                <button type="button" class="btn password-btn-global" id="choose_totp_btn">Google Authenticator (TOTP)</button>\
                <button type="button" class="btn password-btn-global cancel-btn" id="skip_2fa_btn">Skip 2FA</button>\
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
                <button type="button" id="back_from_face_btn" class="btn password-btn-global cancel-btn">Back</button>\
                <div id="face_modal_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>\
            </div>\
        </div>\
        <div id="upload_totp_modal_overlay" class="hidden modal password-modal-global">\
            <div class="boxarea password-card-global" id="totp_modal_card" style="max-width: 500px;">\
                <h2 class="password-title-global">Setup Google Authenticator</h2>\
                <p style="margin-bottom: 20px; color: #eee; opacity: 0.8;">Scan this QR code with Google Authenticator app.</p>\
                <div id="totp_qr_container" style="text-align: center; margin-bottom: 20px;">\
                    <div id="totp_qr_code"></div>\
                </div>\
                <div style="margin-bottom: 20px;">\
                    <label style="color: #eee; display: block; margin-bottom: 8px; font-size: 14px;">Or enter this secret manually:</label>\
                    <input type="text" id="totp_secret_display" readonly class="password-input-global" style="font-family: monospace; text-align: center; font-size: 18px; letter-spacing: 2px;" />\
                </div>\
                <div style="margin-bottom: 20px;">\
                    <label style="color: #eee; display: block; margin-bottom: 8px; font-size: 14px;">Verify by entering the 6-digit code:</label>\
                    <input type="text" id="totp_verify_input" placeholder="000000" maxlength="6" class="password-input-global" style="font-family: monospace; text-align: center; font-size: 24px; letter-spacing: 4px;" />\
                </div>\
                <button type="button" class="btn password-btn-global" id="verify_totp_btn">Verify & Encrypt</button>\
                <button type="button" id="back_from_totp_btn" class="btn password-btn-global cancel-btn">Back</button>\
                <div id="totp_modal_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>\
            </div>\
        </div>\
        ',
    init: function () {
        upload.modules.setdefault(this);
        $(document).on('change', '#filepicker', this.pickerchange.bind(this));
        $(document).on('click', '#pastearea', this.pickfile.bind(this));
        $(document).on('dragover', '#pastearea', this.dragover.bind(this));
        $(document).on('dragleave', '#pastearea', this.dragleave.bind(this));
        $(document).on('drop', '#pastearea', this.drop.bind(this));
        $(document).on('click', '#newpaste', this.newpaste.bind(this));
        $(document).on('click', this.triggerfocuspaste.bind(this));
        this.initpastecatcher();
        $(document).on('paste', this.pasted.bind(this));
        $(document).on('click', '#continue_from_expiry', this.selectExpiry.bind(this));
        $(document).on('click', '#cancel_upload_start', this.cancelUpload.bind(this));
        $(document).on('click', '#back_to_expiry', this.backToExpiry.bind(this));
        $(document).on('submit', '#passwordform', this.submitpassword.bind(this));
        $(document).on('click', '#choose_face_btn', this.chooseFace.bind(this));
        $(document).on('click', '#choose_totp_btn', this.chooseTOTP.bind(this));
        $(document).on('click', '#skip_2fa_btn', this.skip2FA.bind(this));
        $(document).on('click', '#capture_face_btn', this.captureFace.bind(this));
        $(document).on('click', '#back_from_face_btn', this.backFrom2FA.bind(this));
        $(document).on('click', '#verify_totp_btn', this.verifyTOTP.bind(this));
        $(document).on('click', '#back_from_totp_btn', this.backFrom2FA.bind(this));
        $(document).on('input', '#totp_verify_input', this.formatTOTPInput.bind(this));
        this.state = {};
    },
    dragleave: function (e) { e.preventDefault(); e.stopPropagation(); this._.pastearea.removeClass('dragover') },
    drop: function (e) { e.preventDefault(); this._.pastearea.removeClass('dragover'); if (e.dataTransfer.files.length > 0) this.doupload(e.dataTransfer.files[0]) },
    dragover: function (e) { e.preventDefault(); this._.pastearea.addClass('dragover') },
    pickfile: function(e) { this._.filepicker.click() },
    pickerchange: function(e) { if (e.target.files.length > 0) { this.doupload(e.target.files[0]); $(e.target).parents('form')[0].reset() } },
    route: function (route, content) { if (!route && !content) return this; return false; },
    render: function (view) {
        view.html(this.template);
        this._ = {};
        this._.view = view;
        this._.filepicker = view.find('#filepicker');
        this._.pastearea = view.find('#pastearea');
        this._.newpaste = view.find('#newpaste');
        this._.progress = { main: view.find('#uploadprogress'), type: view.find('#progresstype'), amount: view.find('#progressamount'), bg: view.find('#progressamountbg') };
        this._.expiryModal = view.find('#expiry_modal_overlay');
        this._.expiryCard = view.find('#expiry_modal_card');
        this._.expiryValue = view.find('#expiry_value');
        this._.expiryUnit = view.find('#expiry_unit');
        this._.expiryErrorMsg = view.find('#expiry_error_msg');
        this._.passwordmodal = view.find('#upload_password_modal_overlay');
        this._.passwordfield = view.find('#passwordfield');
        this._.uploadview = view.find('#uploadview');
        this._.uploadErrorMsg = view.find('#upload_password_error_msg');
        this._.passwordCard = view.find('#passwordmodal_card');
        this._.twofaChoiceModal = view.find('#twofa_choice_modal_overlay');
        this._.twofaChoiceCard = view.find('#twofa_choice_card');
        this._.facemodal = view.find('#upload_face_modal_overlay');
        this._.faceCard = view.find('#face_modal_card');
        this._.faceWebcam = view.find('#face_webcam')[0];
        this._.faceCanvas = view.find('#face_canvas')[0];
        this._.faceSpinner = view.find('#face_spinner');
        this._.faceErrorMsg = view.find('#face_modal_error_msg');
        this._.totpmodal = view.find('#upload_totp_modal_overlay');
        this._.totpCard = view.find('#totp_modal_card');
        this._.totpQRContainer = view.find('#totp_qr_code');
        this._.totpSecretDisplay = view.find('#totp_secret_display');
        this._.totpVerifyInput = view.find('#totp_verify_input');
        this._.totpErrorMsg = view.find('#totp_modal_error_msg');
        this.webcam = new Webcam(this._.faceWebcam, 'user', this._.faceCanvas); 
        $('#footer').show();
    },
    initroute: function () { this.focuspaste() },
    unrender: function() { if (this.webcam) this.webcam.stop(); delete this['_'] },
    initpastecatcher: function () { this.pastecatcher = $('<pre>').prop('id', 'pastecatcher').prop('contenteditable', true); $('body').append(this.pastecatcher) },
    focuspaste: function () { setTimeout(() => this.pastecatcher.focus(), 100) },
    triggerfocuspaste: function(e) { if (e.which != 1) return; if (e.target == document.body && this._ && !this._.pastearea.hasClass('hidden')) { e.preventDefault(); this.focuspaste() } },
    progress: function(e) {
        this._.progress.type.text(e.eventsource != 'encrypt' ? 'Creating Locker' : 'Encrypting Locker');
        var percent = (e.loaded / e.total) * 100;
        this._.progress.bg.css('width', percent + '%');
        this._.progress.amount.text(Math.floor(percent) + '%');
    },
    doupload: function (blob) {
        this._.uploadblob = blob;
        this.state = {};
        this._.uploadview.addClass('hidden');
        this._.expiryModal.removeClass('hidden');
        this._.expiryValue.val('24');
        this._.expiryUnit.val('hours');
        this._.expiryErrorMsg.text('');
        anime.remove(this._.expiryCard[0]);
        anime({ targets: this._.expiryCard[0], scale: [0.9, 1], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
    },
    selectExpiry: function(e) {
        var self = this;
        var value = parseInt(this._.expiryValue.val(), 10);
        var unit = this._.expiryUnit.val();
        
        if (isNaN(value) || value < 1) {
            this._.expiryErrorMsg.text("Please enter a positive number.");
            anime({ targets: self._.expiryCard[0], translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
            return;
        }

        var durationInHours;
        if (unit === 'days') {
            durationInHours = value * 24;
        } else { // 'hours' is the only other option
            durationInHours = value;
        }

        if (durationInHours > 30 * 24) {
            this._.expiryErrorMsg.text("Maximum duration is 30 days.");
            anime({ targets: self._.expiryCard[0], translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
            return;
        }
        
        this.state.duration = durationInHours;
        this._.expiryErrorMsg.text('');

        anime({
            targets: self._.expiryCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad',
            complete: function() {
                self._.expiryModal.addClass('hidden');
                self._.passwordmodal.removeClass('hidden');
                self._.passwordfield.focus();
                self._.uploadErrorMsg.text('');
                anime.remove(self._.passwordCard[0]);
                anime({ targets: self._.passwordCard[0], scale: [0.9, 1], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
            }
        });
    },
    backToExpiry: function() {
        var self = this;
         anime({
            targets: self._.passwordCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad',
            complete: function() {
                self._.passwordmodal.addClass('hidden');
                self._.passwordfield.val('');
                self._.expiryModal.removeClass('hidden');
                 anime.remove(self._.expiryCard[0]);
                anime({ targets: self._.expiryCard[0], scale: [0.9, 1], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
            }
        });
    },
    cancelUpload: function() {
        var self = this;
        var cardToAnimate = !this._.expiryModal.hasClass('hidden') ? this._.expiryCard[0] : this._.passwordCard[0];
        anime({
            targets: cardToAnimate, scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad',
            complete: function() {
                self._.uploadblob = null;
                self._.expiryModal.addClass('hidden');
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
            anime({ targets: self._.passwordCard[0], translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
            return;
        }
        this.state.password = password;
        anime({
            targets: self._.passwordCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad',
            complete: function() {
                self._.passwordmodal.addClass('hidden');
                self._.passwordfield.val('');
                self._.uploadErrorMsg.text('');
                self.show2FAChoice();
            }
        });
    },
    show2FAChoice: function() {
        this._.twofaChoiceModal.removeClass('hidden');
        anime.remove(this._.twofaChoiceCard[0]);
        anime({ targets: this._.twofaChoiceCard[0], scale: [0.9, 1], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
    },
    chooseFace: function() { var self = this; anime({ targets: self._.twofaChoiceCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad', complete: () => { self._.twofaChoiceModal.addClass('hidden'); self.startFaceModal(); } }); },
    chooseTOTP: function() { var self = this; anime({ targets: self._.twofaChoiceCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad', complete: () => { self._.twofaChoiceModal.addClass('hidden'); self.startTOTPModal(); } }); },
    skip2FA: function() { var self = this; anime({ targets: self._.twofaChoiceCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad', complete: () => { self._.twofaChoiceModal.addClass('hidden'); self.startUpload(null); } }); },
    backFrom2FA: function() {
        var self = this;
        if (!this._.facemodal.hasClass('hidden')) {
            this.webcam.stop();
            anime({ targets: self._.faceCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad', complete: () => { self._.facemodal.addClass('hidden'); self.show2FAChoice(); } });
        } else if (!this._.totpmodal.hasClass('hidden')) {
            anime({ targets: self._.totpCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad', complete: () => { self._.totpmodal.addClass('hidden'); self.show2FAChoice(); } });
        }
    },
    startFaceModal: function() {
        var self = this;
        this._.facemodal.removeClass('hidden');
        this._.faceSpinner.addClass('hidden');
        this._.faceErrorMsg.text('');
        anime.remove(this._.faceCard[0]);
        anime({ targets: this._.faceCard[0], scale: [0.9, 1], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
        this.webcam.start().then(result => console.log("Webcam started")).catch(err => { console.error("Error starting webcam:", err); self._.faceErrorMsg.text("Could not start webcam. Please allow camera access."); });
    },
    captureFace: function() {
        var self = this;
        var faceDataUri = this.webcam.snap();
        if (!faceDataUri) return this._.faceErrorMsg.text("Failed to capture image. Please try again.");
        this._.faceSpinner.removeClass('hidden');
        this._.faceErrorMsg.text('');
        $.get('/public_key').done(keyData => self.encryptFaceAndUpload(faceDataUri, keyData.key)).fail(() => { self._.faceSpinner.addClass('hidden'); self._.faceErrorMsg.text("Error: Could not contact server to get public key."); });
    },
    encryptFaceAndUpload: function(faceDataUri, pubKeyBase64) {
        crypt.encryptFace(pubKeyBase64, faceDataUri).done(result => this.startUpload({ type: 'face', data: result.encryptedFace })).fail(err => { console.error("Face encryption failed:", err); this._.faceSpinner.addClass('hidden'); this._.faceErrorMsg.text("A crypto error occurred during face encryption."); });
    },
    startTOTPModal: function() {
        var self = this;
        this._.totpmodal.removeClass('hidden');
        this._.totpErrorMsg.text('');
        this._.totpVerifyInput.val('');
        anime.remove(this._.totpCard[0]);
        anime({ targets: this._.totpCard[0], scale: [0.9, 1], opacity: [0, 1], duration: 400, easing: 'easeOutQuad' });
        $.get('/generate_totp').done(function(response) { self.state.totpSecret = response.secret; self._.totpSecretDisplay.val(response.secret); self._.totpQRContainer.html('<img src="' + response.qrCode + '" style="max-width: 100%; height: auto;" />'); }).fail(() => self._.totpErrorMsg.text("Error: Could not generate TOTP secret."));
    },
    formatTOTPInput: function(e) { e.target.value = e.target.value.replace(/\D/g, ''); },
    verifyTOTP: function() {
        var self = this;
        var code = this._.totpVerifyInput.val();
        if (code.length !== 6) {
            this._.totpErrorMsg.text("Please enter a 6-digit code.");
            anime.remove(self._.totpCard[0]);
            anime({ targets: self._.totpCard[0], translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
            return;
        }
        this._.totpErrorMsg.text('Verifying...');
         $.ajax({
            type: 'POST', url: '/verify_totp_setup', data: JSON.stringify({ secret: this.state.totpSecret, token: code }), contentType: 'application/json; charset=utf-8', dataType: 'json',
            success: function(response) {
                if (response.valid) {
                    $.get('/public_key').done(keyData => self.encryptTOTPAndUpload(self.state.totpSecret, keyData.key)).fail(() => self._.totpErrorMsg.text("Error: Could not contact server to get public key."));
                } else {
                    self._.totpErrorMsg.text("Invalid code. Please try again.");
                    anime.remove(self._.totpCard[0]);
                    anime({ targets: self._.totpCard[0], translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
                }
            },
            error: function(xhr) {
                var errorMessage = "Verification failed. Please try again.";
                try { var errorResponse = JSON.parse(xhr.responseText); if (errorResponse && errorResponse.error) errorMessage = errorResponse.error; } catch (e) {}
                self._.totpErrorMsg.text(errorMessage);
                anime.remove(self._.totpCard[0]);
                anime({ targets: self._.totpCard[0], translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
            }
        });
    },
    encryptTOTPAndUpload: function(totpSecret, pubKeyBase64) {
        crypt.encryptTOTP(pubKeyBase64, totpSecret).done(result => this.startUpload({ type: 'totp', data: result.encryptedTOTP })).fail(err => { console.error("TOTP encryption failed:", err); this._.totpErrorMsg.text("A crypto error occurred during TOTP encryption."); });
    },
    startUpload: function(twoFAData) {
        var self = this;
        if (this.webcam) this.webcam.stop();
        var closeModal = () => self.showProgressAndUpload(twoFAData);
        var activeModalCard = null;
        if (!this._.facemodal.hasClass('hidden')) activeModalCard = this._.faceCard;
        else if (!this._.totpmodal.hasClass('hidden')) activeModalCard = this._.totpCard;
        if (activeModalCard) {
            anime({ targets: activeModalCard[0], scale: [1, 0.9], opacity: [1, 0], duration: 300, easing: 'easeInQuad', complete: function() { activeModalCard.parent().addClass('hidden'); closeModal(); } });
        } else { closeModal(); }
    },
    showProgressAndUpload: function(twoFAData) {
        this._.pastearea.addClass('hidden');
        this._.progress.main.removeClass('hidden');
        this._.progress.type.text('Encrypting Locker');
        this._.progress.bg.css('width', 0);
        this._.newpaste.addClass('hidden');
        upload.updown.upload(this._.uploadblob, this.progress.bind(this), this.uploaded.bind(this), this.state.password, twoFAData);
        this._.uploadblob = null;
    },
    closepaste: function() { this._.pastearea.removeClass('hidden'); this._.view.find('#uploadview').show(); this._.view.find('.viewswitcher').show(); },
    dopasteupload: function (data) { this._.pastearea.addClass('hidden'); this._.view.find('#uploadview').hide(); this._.view.find('.viewswitcher').hide(); upload.textpaste.render(this._.view, 'Untitled-Memo.txt', data, 'text/plain', this.closepaste.bind(this)); },
    uploaded: function (data, response) {
        var self = this;
        if (self.state.duration !== undefined) {
            $.post('/set_expiry/' + data.ident, {
                delkey: response.delkey,
                duration: self.state.duration
            })
            .done(() => console.log('Expiry set for ' + data.ident))
            .fail(() => console.error('Failed to set expiry for ' + data.ident));
        }
        self.state = {}; 

        upload.download.delkeys[data.ident] = response.delkey;
        try { localStorage.setItem('delete-' + data.ident, response.delkey) } catch (e) { console.log(e) }
        if (window.location.hash == '#noref') {
            history.replaceState(undefined, undefined, '#' + data.seed);
            upload.route.setroute(upload.download, undefined, data.seed);
        } else {
            window.location = '#' + data.seed;
        }
    },
    newpaste: function() { this.dopasteupload('') },
    pasted: function (e) {
        if (!this._ || this._.pastearea.hasClass('hidden') || !this._.uploadview.is(':visible')) return;
        var items = e.clipboardData.items;
        var text = e.clipboardData.getData('text/plain');
        if (text) { e.preventDefault(); this.dopasteupload(text); } 
        else if (typeof items == 'undefined') {
            let self = this;
            setTimeout(() => {
                if (self.pastecatcher.find('img').length) {
                    var src = self.pastecatcher.find('img').prop('src');
                    if (src.startsWith('data:')) self.doupload(dataURItoBlob(src));
                }
            }, 0);
        } else if (items.length >= 1) {
            e.preventDefault();
            for (var i = 0; i < items.length; i++) { var blob = items[i].getAsFile(); if (blob) { this.doupload(blob); break; } }
        }
    },
});