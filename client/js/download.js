// --- Helper function for error animation ---
function shakeModal(cardElement) {
    if (cardElement) anime({ targets: cardElement, translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
}

// --- Generic Modal Setup Factory ---
function setupPrompt(config) {
    if (window[config.globalGetFn] || document.getElementById(config.modalId)) return;

    $('body').append(config.html);
    
    const modalElement = new bootstrap.Modal(document.getElementById(config.modalId));
    const cardElement = modalElement._element.querySelector('.modal-content');
    const errorMsg = $(`#${config.errorMsgId}`);
    
    // State variables
    let currentVerifyCallback, currentCancelCallback;
    let actionType = 'CANCEL'; // Can be 'CANCEL' or 'SUBMIT'
    let submissionData = null; // Store data to pass after hide

    // --- BUTTON CLICK HANDLER ---
    $(`#${config.submitBtnId}`).on('click', () => {
        // 1. Capture the data immediately
        const captureProxy = (data) => {
            submissionData = data;
            actionType = 'SUBMIT'; // Mark as a submit action
            modalElement.hide();   // Start hiding. We do NOTHING else yet.
        };
        config.submitHandler(captureProxy);
    });

    if (config.inputId) {
        $(`#${config.inputId}`).on('keypress', e => { 
            if (e.which === 13) { 
                e.preventDefault(); 
                $(`#${config.submitBtnId}`).click(); 
            } 
        });
    }

    // --- MODAL EVENTS ---
    $(modalElement._element).on('show.bs.modal', () => {
        // Reset state on open
        actionType = 'CANCEL'; 
        submissionData = null;
        config.onShow?.();
    });

    // --- THE FIX: LOGIC RUNS ONLY AFTER ANIMATION ENDS ---
    $(modalElement._element).on('hidden.bs.modal', () => {
        config.onHide?.();

        if (actionType === 'SUBMIT') {
            // The modal is fully hidden. Now it is safe to run logic that might re-open it.
            if (currentVerifyCallback) currentVerifyCallback(submissionData);
        } else {
            // The user clicked X or Cancel
            if (currentCancelCallback) currentCancelCallback();
            currentVerifyCallback = null;
            currentCancelCallback = null;
        }
    });

    // --- GLOBAL API HOOKS ---
    window[config.globalGetFn] = (verifyCb, cancelCb, errText) => {
        currentVerifyCallback = verifyCb;
        currentCancelCallback = cancelCb;
        errorMsg.text(errText || '');
        if(config.inputId) $(`#${config.inputId}`).val('');
        
        actionType = 'CANCEL'; // Default to cancel unless button clicked
        modalElement.show();
        
        if (errText) shakeModal(cardElement);
    };

    window[config.globalErrorFn] = (msg) => {
        config.onError?.();
        errorMsg.text(msg);
        if(config.inputId) $(`#${config.inputId}`).val('').focus();
        
        // No timeout needed. We are guaranteed to be hidden here.
        actionType = 'CANCEL'; // Reset action so next hide is a cancel unless clicked
        modalElement.show(); 
        shakeModal(cardElement);
    };

    window[config.globalStopFn] = () => {
        // This is called on success. We just ensure we don't trigger the cancel callback.
        // Since the modal is likely already hidden (for the progress bar), this ensures state is clean.
        actionType = 'SUBMIT'; 
        modalElement.hide();
    };
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
        // --- Password Modal Config ---
        setupPrompt({
            modalId: 'password_modal', globalGetFn: 'getPassword', globalErrorFn: 'showPasswordError', globalStopFn: 'stopPasswordPrompt',
            errorMsgId: 'password_error_msg', submitBtnId: 'submit_decryption_password', inputId: 'decryption_password',
            html: `
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
                            <button type="button" id="submit_decryption_password" class="btn btn-primary w-100">Decrypt</button>
                            <button type="button" class="btn cancel-btn w-100" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>`,
            submitHandler: (cb) => {
                const password = $('#decryption_password').val();
                if (!password) return window.showPasswordError("Please enter a password.");
                // We pass the password to the proxy, which sets submissionData and hides the modal
                if (cb) cb(password);
            }
        });
        
        // --- Face Scan Modal Config ---
        let faceWebcam;
        setupPrompt({
            modalId: 'download_face_modal', globalGetFn: 'getFaceScan', globalErrorFn: 'showFaceScanError', globalStopFn: 'stopFaceScan',
            errorMsgId: 'download_face_error_msg', submitBtnId: 'download_capture_face_btn',
            html: `
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
                            <button type="button" class="btn btn-primary w-100" id="download_capture_face_btn">Verify My Face</button>                        
                            <button type="button" class="btn cancel-btn w-100" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>`,
            onShow: () => {
                const video = document.getElementById('download_face_webcam');
                const canvas = document.getElementById('download_face_canvas');
                faceWebcam = new Webcam(video, 'user', canvas);
                video.addEventListener('loadedmetadata', () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }, { once: true });
                faceWebcam.start({ width: { ideal: 4096 }, height: { ideal: 2160 } })
                    .catch(err => $('#download_face_error_msg').text("Could not start webcam."));
            },
            onHide: () => { if (faceWebcam) { faceWebcam.stop(); faceWebcam = null; } },
            onError: () => $('#download_face_spinner').addClass('d-none'),
            submitHandler: (cb) => {
                const video = document.getElementById('download_face_webcam');
                const canvas = document.getElementById('download_face_canvas');
                if (video.readyState < 2) return window.showFaceScanError("Webcam is not ready.");
                const context = canvas.getContext('2d');
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const faceDataUri = canvas.toDataURL('image/png');
                if (!faceDataUri) return window.showFaceScanError("Failed to capture image.");
                
                // Show visual feedback immediately, even though we hide
                $('#download_face_spinner').removeClass('d-none');
                
                if (cb) cb(faceDataUri);
            }
        });

        // --- TOTP Modal Config ---
        setupPrompt({
            modalId: 'download_totp_modal', globalGetFn: 'getTOTPCode', globalErrorFn: 'showTOTPError', globalStopFn: 'stopTOTPPrompt',
            errorMsgId: 'download_totp_error_msg', submitBtnId: 'download_verify_totp_btn', inputId: 'download_totp_input',
            html: `
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
                            <button type="button" id="download_verify_totp_btn" class="btn btn-primary w-100">Verify Code</button>
                            <button type="button" class="btn cancel-btn w-100" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>`,
            submitHandler: (cb) => {
                const code = $('#download_totp_input').val();
                if (code.length !== 6) return window.showTOTPError("Please enter a 6-digit code.");
                if (cb) cb(code);
            }
        });
        
        $(document).on('click', '#editpaste', this.editpaste.bind(this));
    },
    route: (routeroot, content) => !routeroot && content,
    render: function (view) {
        view.html(this.template);
        this._ = {
            view,
            detailsarea: view.find('#downloaddetails'),
            filename: view.find('#downloaded_filename'),
            btns: view.find('#btnarea'),
            deletebtn: view.find('#deletebtn'),
            dlbtn: view.find('#dlbtn'),
            viewbtn: view.find('#inbrowserbtn'),
            newupload: view.find('#newupload'),
            editpaste: view.find('#editpaste'),
            title: $('title')
        };
        
        const progressHtml = `
            <div id="download_progress_container" class="boxarea" style="width: 100%; max-width: 450px;">
                <h1 id="download_status_text">Initializing...</h1>
                <div class="progress mt-3" style="height: 10px; background-color: rgba(0,0,0,0.2);">
                    <div id="download_progress_bar" class="progress-bar" role="progressbar" style="width: 0%;"></div>
                </div>
                <h1 id="download_percentage_text" class="mt-3">0%</h1>
            </div>
        `;
        
        this._.detailsarea.empty().append(progressHtml);
        
        this._.content = {
            container: this._.detailsarea.find('#download_progress_container'),
            status: this._.detailsarea.find('#download_status_text'),
            bar: this._.detailsarea.find('#download_progress_bar'),
            percent: this._.detailsarea.find('#download_percentage_text')
        };

        $('#footer').hide();
    },
    initroute: function (content) {
        delete this._.text;
        this._.filename.hide();
        this._.title.text("SecureFile Locker");
        this._.btns.hide();
        this._.editpaste.addClass('d-none');
        this._.newupload.hide();
        
        if (this._.content) {
            this._.content.status.text('Initializing Locker Download...');
            this._.content.bar.removeClass('bg-danger').css('width', '0%');
            this._.content.percent.text('0%');
        }
        
        this._.deletebtn.hide();
        upload.updown.download(content, this.progress.bind(this), this.downloaded.bind(this));
    },
    unrender: function () {
        this._.title.text('SecureFile Locker');
        $('.modal').modal('hide');
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
            this._.detailsarea.html($('<img>').addClass('img-fluid rounded shadow-lg dragresize').prop('src', url));
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
            this._.detailsarea.html($('<video>').prop({controls:true, autoplay:true, src:url}).addClass('w-100 rounded shadow-lg'));
        } else if (association === 'audio') {
            this._.detailsarea.html($('<audio>').prop({controls:true, autoplay:true, src:url}));
        } else {
            this._.detailsarea.html($('<div>').addClass('downloadexplain text-white-50').html(`<h3>Ready to Download</h3><p>Click the Download button below.</p>`));
        }
        this._.btns.show();
    },
    editpaste: function() {
        if (!this._.text?.data) return;
        upload.pendingMemoData = {
            name: this._.text.header.name,
            data: this._.text.data,
            mime: this._.text.header.mime || 'text/plain'
        };
        window.location.hash = '#edit';
    },
    progress: function (e) {
        if (!this._.content) return;
        
        const messages = {
            'decrypting': 'Decrypting Locker', 
            'error': 'Locker Not Found or Expired',
            'waiting_for_password': 'Password Required', 
            'waiting_for_face': 'Facial Verification Required',
            'verifying_face': 'Verifying Face', 
            'waiting_for_totp': 'TOTP Code Required',
            'verifying_totp': 'Verifying TOTP', 
            'cancelled': 'Decryption Cancelled'
        };

        if (typeof e === 'string') {
            let msg = messages[e] || 'An error occurred';
            
            let htmlContent = msg;
            if (e.startsWith('verifying') || e.startsWith('decrypting')) {
                htmlContent += '<span class="animated-dots"></span>';
            }

            this._.content.status.html(htmlContent);
            
            if (['error', 'cancelled'].includes(e)) {
                this._.content.bar.addClass('bg-danger').css('width', '100%');
                this._.content.percent.text('!');
                this._.newupload.show();
            } else if (e === 'decrypting') {
                this._.content.bar.removeClass('bg-danger progress-bar-striped progress-bar-animated').css('width', '0%');
                this._.content.percent.text('0%');
                this._.lastType = 'decrypting'; 
            } else if (['waiting_for_password', 'waiting_for_totp', 'waiting_for_face'].includes(e)) {
                this._.content.bar.removeClass('bg-danger progress-bar-striped progress-bar-animated').css('width', '0%');
                this._.content.percent.text('0%');
            } else if (e.startsWith('waiting')) {
                this._.content.bar.css('width', '100%').addClass('progress-bar-striped progress-bar-animated');
                this._.content.percent.text('Waiting...');
            } else {
                 this._.content.bar.removeClass('bg-danger progress-bar-striped progress-bar-animated');
            }
        } else {
            const type = e.eventsource !== 'encrypt' ? 'Downloading Locker' : 'Decrypting Locker';
            
            if (this._.lastType !== type) {
                this._.lastType = type;
                this._.content.status.html(`${type}<span class="animated-dots"></span>`);
            }

            const percent = (e.loaded / e.total) * 100;
            const percentInt = Math.floor(percent);
            
            this._.content.bar.removeClass('bg-danger progress-bar-striped progress-bar-animated')
                              .css('width', `${percent}%`);
            
            if (percent >= 99) {
                this._.content.percent.text('Finalizing...');
            } else {
                this._.content.percent.text(`${percentInt}%`);
            }
        }
    }
});