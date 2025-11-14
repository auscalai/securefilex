// --- Helper function for error animation ---
function shakeModal(cardElement) {
    anime.remove(cardElement);
    anime({ targets: cardElement, translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
}

function setupModal(modalId, setupFn) {
    if (document.getElementById(modalId.substring(1))) return;
    setupFn();
}

function setupPasswordPrompt() {
    setupModal('#password_modal', () => {
        const modalHtml = `
            <div class="modal fade" id="password_modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content password-card-global">
                        <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">Decryption Key Required</h2></div>
                        <div class="modal-body">
                            <p class="mb-4 text-white-50 text-center">This file is encrypted. Please enter the password to decrypt it.</p>
                            <input type="password" id="decryption_password" placeholder="Enter password..." class="form-control" />
                            <div id="password_error_msg" class="password-error-global mt-2" style="min-height: 1.2em;"></div>
                        </div>
                        <div class="modal-footer border-0 d-flex">
                            <button type="button" class="btn cancel-btn w-100 me-2" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" id="submit_decryption_password" class="btn btn-primary w-100">Decrypt</button>
                        </div>
                    </div>
                </div>
            </div>`;
        $('body').append(modalHtml);

        const modalElement = new bootstrap.Modal($('#password_modal')[0]);
        const cardElement = $(modalElement._element).find('.modal-content')[0];
        const input = $('#decryption_password');
        const errorMsg = $('#password_error_msg');
        let currentVerifyCallback = null, currentCancelCallback = null;

        const submitPassword = () => {
            const password = input.val();
            if (!password) return window.showPasswordError("Please enter a password.");
            if (currentVerifyCallback) {
                errorMsg.text('Decrypting...');
                currentVerifyCallback(password);
            }
        };

        $('#submit_decryption_password').on('click', submitPassword);
        input.on('keypress', (e) => { if (e.which === 13) { e.preventDefault(); submitPassword(); } });
        $(modalElement._element).on('hidden.bs.modal', () => { 
            if (currentCancelCallback) currentCancelCallback();
            currentVerifyCallback = null;
            currentCancelCallback = null;
        });

        window.getPassword = (verifyCallback, cancelCallback, errorMsgText) => {
            currentVerifyCallback = verifyCallback;
            currentCancelCallback = cancelCallback;
            input.val('');
            errorMsg.text(errorMsgText || '');
            modalElement.show();
            $(modalElement._element).off('shown.bs.modal').on('shown.bs.modal', () => input.focus());
            if (errorMsgText) shakeModal(cardElement);
        };
        window.showPasswordError = (msg) => {
            errorMsg.text(msg || 'Incorrect password.');
            input.val('').focus();
            shakeModal(cardElement);
        };
        window.stopPasswordPrompt = () => modalElement.hide();
    });
}

function setupFaceScanPrompt() {
    setupModal('#download_face_modal', () => {
        var modalHtml = `
            <div class="modal fade" id="download_face_modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content password-card-global" style="max-width: 540px;">
                        <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">Facial Verification Required</h2></div>
                        <div class="modal-body text-center">
                            <p class="mb-3 text-white-50">Please center your face in the camera to verify.</p>
                            <div id="download_face_webcam_container" class="position-relative">
                                <video id="download_face_webcam" class="w-100" autoplay playsinline></video>
                                <canvas id="download_face_canvas" class="d-none"></canvas>
                                <div id="download_face_spinner" class="spinner-container d-none"><div class="spinner-border text-primary" role="status"></div></div>
                            </div>
                            <div id="download_face_error_msg" class="password-error-global mt-2" style="min-height: 1.2em;"></div>
                        </div>
                        <div class="modal-footer border-0 d-flex">
                            <button type="button" class="btn cancel-btn w-100 me-2" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary w-100" id="download_capture_face_btn">Verify My Face</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(modalHtml);

        var modalElement = new bootstrap.Modal($('#download_face_modal')[0]);
        var cardElement = $(modalElement._element).find('.modal-content')[0];
        var video = $('#download_face_webcam')[0];
        var canvas = $('#download_face_canvas')[0];
        var spinner = $('#download_face_spinner');
        var errorMsg = $('#download_face_error_msg');
        var webcam = new Webcam(video, 'user', canvas);
        var currentVerifyCallback = null;
        var currentCancelCallback = null;

        $(modalElement._element).on('show.bs.modal', function () {
            errorMsg.text('');
            spinner.addClass('d-none');
            webcam.start().catch(err => errorMsg.text("Could not start webcam. Please allow camera access."));
        });

        $(modalElement._element).on('hidden.bs.modal', function () {
            webcam.stop();
            if (currentCancelCallback) currentCancelCallback();
            currentVerifyCallback = null;
            currentCancelCallback = null;
        });

        $('#download_capture_face_btn').on('click', function() {
            if (!currentVerifyCallback) return;
            var faceDataUri = webcam.snap();
            if (!faceDataUri) return window.showFaceScanError("Failed to capture image. Please try again.");
            spinner.removeClass('d-none');
            errorMsg.text('Verifying...');
            currentVerifyCallback(faceDataUri);
        });

        window.getFaceScan = function(verifyCallback, cancelCallback, errorMsgText) {
            currentVerifyCallback = verifyCallback;
            currentCancelCallback = cancelCallback;
            errorMsg.text(errorMsgText || '');
            modalElement.show();
            if (errorMsgText) shakeModal(cardElement);
        };
        window.showFaceScanError = function(msg) {
            spinner.addClass('d-none');
            errorMsg.text(msg);
            shakeModal(cardElement);
        };
        window.stopFaceScan = () => modalElement.hide();
    });
}

function setupTOTPPrompt() {
    setupModal('#download_totp_modal', () => {
        var modalHtml = `
            <div class="modal fade" id="download_totp_modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content password-card-global" style="max-width: 500px;">
                        <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">TOTP Verification Required</h2></div>
                        <div class="modal-body text-center">
                            <p class="mb-3 text-white-50">Enter the 6-digit code from your authenticator app.</p>
                            <input type="text" id="download_totp_input" placeholder="000000" maxlength="6" class="form-control text-center mb-3" style="font-family: monospace; font-size: 1.5rem; letter-spacing: 4px;" />
                            <div id="download_totp_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>
                        </div>
                        <div class="modal-footer border-0 d-flex">
                            <button type="button" class="btn cancel-btn w-100 me-2" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" id="download_verify_totp_btn" class="btn btn-primary w-100">Verify Code</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(modalHtml);
        
        var modalElement = new bootstrap.Modal($('#download_totp_modal')[0]);
        var cardElement = $(modalElement._element).find('.modal-content')[0];
        var input = $('#download_totp_input');
        var errorMsg = $('#download_totp_error_msg');
        var currentVerifyCallback = null;
        var currentCancelCallback = null;
        
        input.on('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
        
        var submitCode = function() {
            var code = input.val();
            if (code.length !== 6) return window.showTOTPError("Please enter a 6-digit code.");
            if (currentVerifyCallback) {
                errorMsg.text('Verifying...');
                currentVerifyCallback(code);
            }
        };
        
        $('#download_verify_totp_btn').on('click', submitCode);
        input.on('keypress', e => { if (e.which === 13) { e.preventDefault(); submitCode(); } });
        $(modalElement._element).on('hidden.bs.modal', () => {
            if (currentCancelCallback) currentCancelCallback();
            currentVerifyCallback = null;
            currentCancelCallback = null;
        });
        
        window.getTOTPCode = function(verifyCallback, cancelCallback, errorMsgText) {
            currentVerifyCallback = verifyCallback;
            currentCancelCallback = cancelCallback;
            input.val('');
            errorMsg.text(errorMsgText || '');
            modalElement.show();
            $(modalElement._element).off('shown.bs.modal').on('shown.bs.modal', () => input.focus());
            if (errorMsgText) shakeModal(cardElement);
        };
        window.showTOTPError = function(msg) {
            errorMsg.text(msg);
            input.val('').focus();
            shakeModal(cardElement);
        };
        window.stopTOTPPrompt = () => modalElement.hide();
    });
}

upload.modules.addmodule({
    name: 'download',
    delkeys: {},
    template: `
        <div class="container-fluid vh-100 d-flex flex-column p-0" id="dlarea">
            <div class="topbar d-flex align-items-center">
                 <h1 id="downloaded_filename" class="text-truncate me-3 fs-4 mb-0 ms-2"></h1>
                 <div class="viewswitcher ms-auto">
                    <a id="editpaste" class="btn btn-primary d-none"><i class="bi bi-pencil-square me-2"></i>Edit Memo</a>
                    <a class="btn btn-primary" id="newupload" href="#"><i class="bi bi-plus-lg me-2"></i>New Locker</a>
                 </div>
            </div>
            <div id="downloaddetails" class="flex-grow-1 d-flex justify-content-center align-items-center text-center p-3"></div>
            <div id="btnarea" class="p-3" style="background-color: rgba(0,0,0,0.2);">
                <div class="d-grid gap-2 d-md-flex justify-content-md-center">
                    <a class="btn btn-primary btn-lg" id="dlbtn" href="#"><i class="bi bi-download me-2"></i>Download</a>
                    <a class="btn btn-outline-secondary btn-lg" id="inbrowserbtn" target="_blank" href="#"><i class="bi bi-eye me-2"></i>View In Browser</a>
                    <a class="btn btn-outline-danger btn-lg" id="deletebtn" href="#"><i class="bi bi-trash me-2"></i>Delete</a>
                </div>
            </div>
        </div>
    `,
    init: function () {
        setupPasswordPrompt();
        setupFaceScanPrompt();
        setupTOTPPrompt();
        $(document).on('click', '#editpaste', this.editpaste.bind(this));
    },
    route: (routeroot, content) => !routeroot && content,
    render: function (view) {
        view.html(this.template);
        this._ = {
            view: view,
            detailsarea: view.find('#downloaddetails'),
            filename: view.find('#downloaded_filename'),
            btns: view.find('#btnarea'),
            deletebtn: view.find('#deletebtn'),
            dlbtn: view.find('#dlbtn'),
            viewbtn: view.find('#inbrowserbtn'),
            newupload: view.find('#newupload'),
            editpaste: view.find('#editpaste'),
            dlarea: view.find('#dlarea'),
            title: $('title'),
            content: { main: $('<h1>').prop('id', 'downloadprogress').addClass('text-white-50').text('Initializing...') }
        };
        this._.detailsarea.empty().append(this._.content.main);
        $('#footer').hide();
    },
    initroute: function (content) {
        delete this._.text;
        this._.filename.hide();
        this._.title.text("SecureFile Locker");
        this._.btns.hide();
        this._.editpaste.addClass('d-none');
        this._.newupload.hide();
        this._.dlarea.show();
        this._.content.main.text('Initializing Locker Download...');
        this._.deletebtn.hide();
        upload.updown.download(content, this.progress.bind(this), this.downloaded.bind(this));
    },
    unrender: function () {
        this._.title.text('SecureFile Locker');
        $('.modal').modal('hide'); // Let Bootstrap handle cleanup
        delete this._;
    },
    associations: {
      'text/': 'text', 'application/javascript': 'text', 'application/xml': 'text',
      'image/': 'image', 'image/svg+xml': 'svg',
      'audio/': 'audio',
      'video/': 'video',
      'application/pdf': 'pdf'
    },
    getassociation: function(mime) {
        for (const key in this.associations) {
            if (mime.startsWith(key)) return this.associations[key];
        }
    },
    downloaded: function (data) {
        $('.modal').modal('hide');
        this._.filename.text(data.header.name).show();
        this._.title.text(data.header.name + ' - SecureFile Locker');
        
        const stored = localStorage.getItem('delete-' + data.ident);
        if (stored) {
            this._.deletebtn.show().prop('href', `${upload.config.server || ''}del?delkey=${stored}&ident=${data.ident}`);
        }
        this._.newupload.show();

        const association = this.getassociation(data.header.mime);
        const decrypted = new Blob([data.decrypted], { type: data.header.mime });
        const url = URL.createObjectURL(decrypted);

        this._.dlbtn.prop('href', url).prop('download', data.header.name);
        this._.viewbtn.prop('href', url).toggle(!!association);
        this._.detailsarea.empty();

        if (association === 'image' || association === 'svg') {
            $('<img>').addClass('img-fluid rounded shadow-lg dragresize').prop('src', url).appendTo(this._.detailsarea);
        } else if (association === 'text') {
            this._.detailsarea.removeClass('d-flex justify-content-center align-items-center text-center p-3').css('padding', '0');
            const textarea = $('<textarea>')
                .addClass('memo-editor-textarea')
                .prop('readonly', true)
                .appendTo($('<div>').addClass('memo-editor-wrapper').appendTo(
                    $('<div>').addClass('memo-editor-area flex-grow-1 position-relative').css('height', '100%').appendTo(this._.detailsarea)
                ));
            
            const fr = new FileReader();
            fr.onload = () => {
                this._.text = { header: data.header, data: fr.result };
                textarea.val(fr.result);
                this._.editpaste.removeClass('d-none');
            };
            fr.readAsText(data.decrypted);
        } else if (association === 'video') {
            $('<video>').prop({controls:true, autoplay:true, src:url}).addClass('w-100 rounded shadow-lg').appendTo(this._.detailsarea);
        } else if (association === 'audio') {
            $('<audio>').prop({controls:true, autoplay:true, src:url}).appendTo(this._.detailsarea);
        } else {
            $('<div>').addClass('downloadexplain text-white-50').html(`<h3>Ready to Download</h3><p>Click the Download button below.</p>`).appendTo(this._.detailsarea);
        }
        this._.btns.show();
    },
    editpaste: function() {
        if (!this._.text?.data) return console.error('[download] No text data to edit!');
        upload.pendingMemoData = {
            name: this._.text.header.name,
            data: this._.text.data,
            mime: this._.text.header.mime || 'text/plain'
        };
        window.location.hash = '#edit';
    },
    progress: function (e) {
        if (!this._.content?.main) return;
        const messages = {
            'decrypting': 'Decrypting Locker...',
            'error': 'Locker Not Found or Expired.',
            'waiting_for_password': 'Password Required.',
            'waiting_for_face': 'Facial Verification Required.',
            'verifying_face': 'Verifying Face...',
            'waiting_for_totp': 'TOTP Code Required.',
            'verifying_totp': 'Verifying TOTP...',
            'cancelled': 'Decryption Cancelled.'
        };
        if (typeof e === 'string') {
            this._.content.main.text(messages[e] || 'An error occurred.');
            if (['error', 'cancelled'].includes(e)) this._.newupload.show();
        } else {
            const text = e.eventsource !== 'encrypt' ? 'Downloading Locker' : 'Decrypting Locker';
            const percent = (e.loaded / e.total) * 100;
            const percentText = (percent >= 99) ? '99% (Verifying...)' : Math.floor(percent) + '%';
            this._.content.main.text(`${text} ${percentText}`);
        }
    }
});