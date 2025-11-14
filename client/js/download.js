// --- Helper function for error animation ---
function shakeModal(cardElement) {
    anime.remove(cardElement);
    anime({ targets: cardElement, translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
}

function setupPasswordPrompt() {
    if (window.getPassword) { return; }

    var modalHtml = `
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
        </div>
    `;
    $('body').append(modalHtml);

    var modalElement = new bootstrap.Modal($('#password_modal')[0]);
    var cardElement = $(modalElement._element).find('.modal-content')[0];
    var input = $('#decryption_password');
    var errorMsg = $('#password_error_msg');
    var currentVerifyCallback = null;
    var currentCancelCallback = null;

    var submitPassword = function() {
        var password = input.val();
        if (!password) {
            window.showPasswordError("Please enter a password.");
            return;
        }
        if (currentVerifyCallback) {
            errorMsg.text('Decrypting...');
            currentVerifyCallback(password);
        }
    };

    $('#submit_decryption_password').on('click', submitPassword);
    input.on('keypress', function(e) { if (e.which === 13) { e.preventDefault(); submitPassword(); } });
    
    $(modalElement._element).on('hidden.bs.modal', () => {
        if (currentCancelCallback) currentCancelCallback();
        currentVerifyCallback = null;
        currentCancelCallback = null;
    });

    window.getPassword = function(verifyCallback, cancelCallback, errorMsgText) {
        currentVerifyCallback = verifyCallback;
        currentCancelCallback = cancelCallback;
        input.val('');
        errorMsg.text(errorMsgText || '');
        modalElement.show();
        $(modalElement._element).off('shown.bs.modal').on('shown.bs.modal', () => input.focus());
        if (errorMsgText) shakeModal(cardElement);
    };

    window.showPasswordError = function(msg) {
        errorMsg.text(msg || 'Incorrect password. Please try again.');
        input.val('').focus();
        shakeModal(cardElement);
    };
    
    window.stopPasswordPrompt = function() {
        modalElement.hide();
    };
}
setupPasswordPrompt();

function setupFaceScanPrompt() {
    if (window.getFaceScan) { return; }

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
        webcam.start()
            .then(result => {})
            .catch(err => {
                errorMsg.text("Could not start webcam. Please allow camera access.");
            });
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
        if (!faceDataUri) {
            window.showFaceScanError("Failed to capture image. Please try again.");
            return;
        }
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

    window.stopFaceScan = function() {
        modalElement.hide();
    };
}
setupFaceScanPrompt();

function setupTOTPPrompt() {
    if (window.getTOTPCode) { return; }
    
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
        if (code.length !== 6) {
            window.showTOTPError("Please enter a 6-digit code.");
            return;
        }
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

        if (errorMsgText) {
            shakeModal(cardElement);
        }
    };
    
    window.showTOTPError = function(msg) {
        errorMsg.text(msg);
        input.val('').focus();
        shakeModal(cardElement);
    };
    
    window.stopTOTPPrompt = function() {
        modalElement.hide();
    };
}
setupTOTPPrompt();

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
      $(document).on('click', '#editpaste', this.editpaste.bind(this));
    },
    route: function (routeroot, content) {
        return !routeroot && content ? this : false;
    },
    render: function (view) {
        view.html(this.template);
        this._ = {};
        this._.view = view;
        this._.detailsarea = view.find('#downloaddetails');
        this._.filename = view.find('#downloaded_filename');
        this._.btns = view.find('#btnarea');
        this._.deletebtn = view.find('#deletebtn');
        this._.dlbtn = view.find('#dlbtn');
        this._.viewbtn = view.find('#inbrowserbtn');
        this._.newupload = view.find('#newupload');
        this._.editpaste = view.find('#editpaste');
        this._.dlarea = view.find('#dlarea');
        this._.title = $('title');
        this._.content = {};
        this._.content.main = this._.content.loading = $('<h1>').prop('id', 'downloadprogress').addClass('text-white-50').text('Initializing...');
        this._.detailsarea.empty().append(this._.content.main);
        $('#footer').hide();
    },
    initroute: function (content, contentroot) {
        delete this._['text'];
        this._.filename.hide();
        this._.title.text("SecureFile Locker");
        this._.btns.hide();
        this._.editpaste.addClass('d-none');
        this._.newupload.hide();
        this._.dlarea.show(); 
        this._.content.loading.text('Initializing Locker Download...');
        this._.deletebtn.hide();
        upload.updown.download(content, this.progress.bind(this), this.downloaded.bind(this));
    },
    unrender: function () {
        this._.title.text('SecureFile Locker');
        $('#password_modal, #download_face_modal, #download_totp_modal').remove();
        $('.modal-backdrop').remove();
        $('body').removeAttr('style').removeClass('modal-open');
        delete window.getPassword;
        delete window.showPasswordError;
        delete window.getFaceScan;
        delete window.showFaceScanError;
        delete window.stopFaceScan;
        delete window.getTOTPCode;
        delete window.showTOTPError;
        delete window.stopTOTPPrompt;
        delete this['_'];
    },
    assocations: {
      'application/javascript': 'text', 'application/x-javascript': 'text', 'application/xml': 'text',
      'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'application/x-pdf': 'pdf', 'text/plain': 'text',
      'audio/aac': 'audio', 'audio/mp4': 'audio', 'audio/mpeg': 'audio', 'audio/ogg': 'audio',
      'audio/wav': 'audio', 'audio/webm': 'audio', 'video/mp4': 'video', 'video/ogg': 'video',
      'video/webm': 'video', 'audio/wave': 'audio', 'audio/wav': 'audio', 'audio/x-wav': 'audio',
      'audio/x-pn-wav': 'audio', 'audio/vnd.wave': 'audio', 'image/tiff': 'image', 'image/x-tiff': 'image',
      'image/bmp': 'image', 'image/x-windows-bmp': 'image', 'image/gif': 'image', 'image/x-icon': 'image',
      'image/jpeg': 'image', 'image/pjpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'text/': 'text'
    },
    safeassocations: { 'text': 'text/plain', 'svg': 'text/plain' },
    getassociation: function(mime) { for (var key in this.assocations) { if (mime.startsWith(key)) return this.assocations[key]; } },
    setupLineNumbers: function(ele) {
      var markup = ele.html();
      ele.html('<div class="line">' + markup.replace(/\n/g, '</div><div class="line">') + '</div>');
      ele.find('.line').each(function(i, e) { $(e).prepend($('<span>').addClass('linenum').text(i + 1)) });
    },
    downloaded: function (data) {
            $('.modal').modal('hide');
            this._.filename.text(data.header.name).show();
            this._.title.text(data.header.name + ' - SecureFile Locker');
            var stored = localStorage.getItem('delete-' + data.ident);
            if (stored && !isiframed()) {
                this._.deletebtn.show().prop('href', (upload.config.server || '') + 'del?delkey=' + stored + '&ident=' + data.ident);
            }
            this._.newupload.show();
            var association = this.getassociation(data.header.mime);
            var decrypted = new Blob([data.decrypted], { type: data.header.mime });
            var url = URL.createObjectURL(decrypted);
            this._.viewbtn.prop('href', url).hide();
            this._.dlbtn.prop('href', url).prop('download', data.header.name);
            delete this._.content;
            this._.detailsarea.empty();
            if (!!association) {
                this._.viewbtn.show();
            }
            if (association == 'image' || association == 'svg') {
                $('<div>').prop('id', 'previewimg').addClass('preview').appendTo(this._.detailsarea).html($('<img>').addClass('img-fluid rounded shadow-lg').prop('src', url));
            } else if (association == 'text') {
                this._.detailsarea.removeClass('d-flex justify-content-center align-items-center text-center p-3').css('padding', '0');
                var textContainer = $('<div>')
                    .addClass('memo-editor-area flex-grow-1 position-relative')
                    .css({ 'height': '100%' }) // Ensure it fills the vertical space
                    .appendTo(this._.detailsarea);

                var wrapper = $('<div>')
                    .addClass('memo-editor-wrapper')
                    .appendTo(textContainer);

                var textarea = $('<textarea>')
                    .addClass('memo-editor-textarea')
                    .prop('readonly', true) // This is a view page, so make it read-only
                    .appendTo(wrapper);

                var fr = new FileReader();
                fr.onload = () => {
                    // This._.text is used by the 'Edit Memo' button, so we must keep it
                    this._.text = { header: data.header, data: fr.result };
                    textarea.val(fr.result); // Populate the textarea with the memo content
                    this._.editpaste.removeClass('d-none'); // Show the 'Edit Memo' button
                };
                fr.readAsText(data.decrypted);
            } else if (association == 'video') {
                $('<div>').addClass('preview').appendTo(this._.detailsarea).html($('<video>').prop({controls:true, autoplay:true, src:url}).addClass('w-100 rounded shadow-lg'));
            } else if (association == 'audio') {
                $('<div>').addClass('preview').appendTo(this._.detailsarea).html($('<audio>').prop({controls:true, autoplay:true, src:url}));
            } else {
                $('<div>').addClass('downloadexplain text-white-50').html(`<h3>Ready to Download</h3><p>Click the Download button below. This locker self-destructs after its expiration time.</p>`).appendTo(this._.detailsarea);
            }
            this._.btns.show();
        },
        closepaste: function() {
          this._.dlarea.show();
        },
        editpaste: function() {
        console.log('[download.js] Edit Memo clicked');
        console.log('[download.js] Current text data:', this._.text);
        
        if (!this._.text || !this._.text.data) {
            console.error('[download.js] No text data available to edit!');
            return;
        }

        // Store the memo data globally so home.js can pick it up
        upload.pendingMemoData = {
            name: this._.text.header.name,
            data: this._.text.data,
            mime: this._.text.header.mime || 'text/plain'
        };

        console.log('[download.js] Stored pendingMemoData:', upload.pendingMemoData);
        console.log('[download.js] Navigating to #edit');

        // Navigate to home page (which will trigger edit mode)
        window.location.hash = '#edit';
    },
    progress: function (e) {
        if (!this._.content || !this._.content.loading) return;
        switch(e) {
            case 'decrypting': this._.content.loading.text('Decrypting Locker...'); break;
            case 'error': this._.content.loading.text('Locker Not Found. It may have expired or been deleted.'); this._.newupload.show(); break;
            case 'waiting_for_password': this._.content.loading.text('Locker is protected. Please enter password.'); break;
            case 'waiting_for_face': this._.content.loading.text('Locker is protected. Please verify your face.'); break;
            case 'verifying_face': this._.content.loading.text('Verifying face...'); break;
            case 'waiting_for_totp': this._.content.loading.text('Locker is protected. Please enter TOTP code.'); break;
            case 'verifying_totp': this._.content.loading.text('Verifying TOTP code...'); break;
            case 'cancelled': this._.content.loading.text('Decryption cancelled by user.'); this._.newupload.show(); break;
            default:
                var text = e.eventsource != 'encrypt' ? 'Downloading Locker' : 'Decrypting Locker';
                var percent = (e.loaded / e.total) * 100;
                var percentText = (percent >= 99) ? '99% (Verifying...)' : Math.floor(percent) + '%';
                this._.content.loading.text(`${text} ${percentText}`);
        }
    }
});