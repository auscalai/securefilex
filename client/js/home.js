upload.modules.addmodule({
    name: 'home',
    template: `
        <div class="topbar">
            <div class="viewswitcher ms-auto">
                <a id="newpaste" class="btn btn-primary"><i class="bi bi-pencil-square me-2"></i>Write a Memo</a>
            </div>
        </div>
        <div class="contentarea" id="uploadview">
            <div class="text-center">
                <div id="pastearea" class="boxarea">
                    <i class="bi bi-upload"></i>
                    <h2 class="mt-3">Drag & Drop Your File</h2>
                    <h3>or click to browse</h3>
                </div>
                <div class="d-none boxarea" id="uploadprogress">
                    <h1 id="progresstype">Encrypting Locker</h1>
                    <div class="progress mt-3" style="height: 10px; background-color: rgba(0,0,0,0.2);">
                         <div id="progressamountbg" class="progress-bar" role="progressbar" style="width: 0%;"></div>
                    </div>
                    <h1 id="progressamount" class="mt-3">0%</h1>
                </div>
                <form><input type="file" id="filepicker" class="d-none" /></form>
            </div>
        </div>
        <div class="modal fade" id="expiry_modal_overlay" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content password-card-global">
                    <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">Set File Expiration</h2></div>
                    <div class="modal-body text-center">
                        <p class="mb-4 text-white-50">The file will be permanently deleted after this time.</p>
                        <div class="d-flex justify-content-center align-items-center mb-3">
                            <input type="number" id="expiry_value" value="24" min="1" class="form-control text-center me-2" style="width: 100px;" />
                            <select id="expiry_unit" class="form-select" style="width: auto;">
                                <option value="hours" selected>Hours</option>
                                <option value="days">Days</option>
                            </select>
                        </div>
                        <div id="expiry_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>
                    </div>
                    <div class="modal-footer border-0 d-flex gap-2">
                        <button type="button" id="continue_from_expiry" class="btn btn-primary w-100">Continue</button>
                        <button type="button" id="cancel_upload_start" class="btn cancel-btn w-100" data-bs-dismiss="modal">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal fade" id="upload_password_modal_overlay" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content password-card-global">
                    <form id="passwordform" class="w-100">
                        <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">Set a Password</h2></div>
                        <div class="modal-body">
                             <p class="mb-4 text-white-50">This password will be required to decrypt the file.</p>
                             <input type="password" id="passwordfield" placeholder="Enter password..." class="form-control" />
                             <div id="upload_password_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>
                        </div>
                        <div class="modal-footer border-0 d-flex">
                            <button type="submit" class="btn btn-primary w-100" id="upload_submit_btn">Continue</button>
                            <button type="button" id="back_to_expiry" class="btn cancel-btn w-100">Back</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        <div class="modal fade" id="twofa_choice_modal_overlay" tabindex="-1">
             <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content password-card-global">
                    <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">Add 2-Factor Authentication</h2></div>
                    <div class="modal-body text-center">
                        <p class="mb-4 text-white-50">Optionally add an extra layer of security to your file.</p>
                        <div class="d-grid gap-2">
                            <button type="button" class="btn btn-primary" id="choose_face_btn"><i class="bi bi-person-bounding-box me-2"></i>Facial Recognition</button>
                            <button type="button" class="btn btn-primary" id="choose_totp_btn"><i class="bi bi-google me-2"></i>Google Authenticator</button>
                            <button type="button" class="btn btn-outline-secondary mt-3" id="skip_2fa_btn">Skip for Now</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal fade" id="upload_face_modal_overlay" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content password-card-global" style="max-width: 540px;">
                    <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">Facial Recognition (2FA)</h2></div>
                    <div class="modal-body text-center">
                        <p class="mb-3 text-white-50">Center your face in the camera to add 2FA.</p>
                        <div id="face_webcam_container" class="position-relative">
                            <video id="face_webcam" class="w-100" autoplay playsinline></video>
                            <canvas id="face_canvas" class="d-none"></canvas>
                            <div id="face_spinner" class="spinner-container d-none"><div class="spinner-border text-primary" role="status"></div></div>
                        </div>
                        <div id="face_modal_error_msg" class="password-error-global mt-2" style="min-height: 1.2em;"></div>
                    </div>
                    <div class="modal-footer border-0 d-flex">
                        <button type="button" class="btn btn-primary w-100" id="capture_face_btn">Capture & Encrypt</button>
                        <button type="button" id="back_from_face_btn" class="btn cancel-btn w-100">Back</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal fade" id="upload_totp_modal_overlay" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content password-card-global" style="max-width: 500px;">
                    <div class="modal-header border-0"><h2 class="modal-title password-title-global w-100 text-center">Setup Google Authenticator</h2></div>
                    <div class="modal-body text-center">
                        <p class="mb-3 text-white-50">Scan this QR code with your authenticator app.</p>
                        <div id="totp_qr_container" class="text-center mb-3 bg-white p-2 rounded d-inline-block"></div>
                        <div class="mb-3">
                            <label class="form-label text-white-50">Or enter this secret manually:</label>
                            <input type="text" id="totp_secret_display" readonly class="form-control text-center" style="font-family: monospace; letter-spacing: 2px;" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-white-50">Verify by entering the 6-digit code:</label>
                            <input type="text" id="totp_verify_input" placeholder="000000" maxlength="6" class="form-control text-center" style="font-family: monospace; font-size: 1.5rem; letter-spacing: 4px;" />
                        </div>
                        <div id="totp_modal_error_msg" class="password-error-global" style="min-height: 1.2em;"></div>
                    </div>
                    <div class="modal-footer border-0 d-flex">
                        <button type="button" class="btn btn-primary w-100" id="verify_totp_btn">Verify & Encrypt</button>
                        <button type="button" id="back_from_totp_btn" class="btn cancel-btn w-100">Back</button>
                    </div>
                </div>
            </div>
        </div>
    `,
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
    shakeModal: function(cardElement) {
        anime.remove(cardElement);
        anime({ targets: cardElement, translateX: [-10, 10, -10, 10, 0], duration: 300, easing: 'easeInOutSine' });
    },
    render: function (view) {
        view.html(this.template);
        this._ = {};
        this._.view = view;
        this._.filepicker = view.find('#filepicker');
        this._.pastearea = view.find('#pastearea');
        this._.newpaste = view.find('#newpaste');
        this._.uploadview = view.find('#uploadview');
        this._.progress = { main: view.find('#uploadprogress'), type: view.find('#progresstype'), amount: view.find('#progressamount'), bg: view.find('#progressamountbg') };
        
        this._.expiryModal = new bootstrap.Modal(view.find('#expiry_modal_overlay')[0]);
        this._.expiryCard = $(this._.expiryModal._element).find('.modal-content')[0];
        this._.expiryValue = view.find('#expiry_value');
        this._.expiryUnit = view.find('#expiry_unit');
        this._.expiryErrorMsg = view.find('#expiry_error_msg');

        this._.passwordmodal = new bootstrap.Modal(view.find('#upload_password_modal_overlay')[0]);
        this._.passwordCard = $(this._.passwordmodal._element).find('.modal-content')[0];
        this._.passwordfield = view.find('#passwordfield');
        this._.uploadErrorMsg = view.find('#upload_password_error_msg');

        this._.twofaChoiceModal = new bootstrap.Modal(view.find('#twofa_choice_modal_overlay')[0]);

        this._.facemodal = new bootstrap.Modal(view.find('#upload_face_modal_overlay')[0]);
        this._.faceCard = $(this._.facemodal._element).find('.modal-content')[0];
        this._.faceSpinner = view.find('#face_spinner');
        this._.faceErrorMsg = view.find('#face_modal_error_msg');
        
        this._.totpmodal = new bootstrap.Modal(view.find('#upload_totp_modal_overlay')[0]);
        this._.totpCard = $(this._.totpmodal._element).find('.modal-content')[0];
        this._.totpQRContainer = view.find('#totp_qr_container');
        this._.totpSecretDisplay = view.find('#totp_secret_display');
        this._.totpVerifyInput = view.find('#totp_verify_input');
        this._.totpErrorMsg = view.find('#totp_modal_error_msg');
        
        $('#footer').show();
    },
    unrender: function() {
        if (this.webcam) {
            this.webcam.stop();
            this.webcam = null;
        }
        ['expiryModal', 'passwordmodal', 'twofaChoiceModal', 'facemodal', 'totpmodal'].forEach(modalKey => {
            if (this._[modalKey] && this._[modalKey].dispose) {
                this._[modalKey].dispose();
            }
        });
        delete this._;
    },
    
    // --- ALL MISSING FUNCTIONS RESTORED ---
    dragleave: function (e) { e.preventDefault(); e.stopPropagation(); this._.pastearea.removeClass('dragover') },
    drop: function (e) { e.preventDefault(); this._.pastearea.removeClass('dragover'); if (e.originalEvent.dataTransfer.files.length > 0) this.doupload(e.originalEvent.dataTransfer.files[0]) },
    dragover: function (e) { e.preventDefault(); this._.pastearea.addClass('dragover') },
    pickfile: function(e) { this._.filepicker.click() },
    pickerchange: function(e) { if (e.target.files.length > 0) { this.doupload(e.target.files[0]); $(e.target).closest('form')[0].reset() } },
    initpastecatcher: function () { this.pastecatcher = $('<pre>').prop('id', 'pastecatcher').prop('contenteditable', true).css({position:'absolute', top: '-9999px'}).appendTo('body') },
    focuspaste: function () { if (this.pastecatcher) setTimeout(() => this.pastecatcher.focus(), 100) },
    triggerfocuspaste: function(e) { if (e.which != 1) return; if (e.target == document.body && this._ && !this._.pastearea.hasClass('d-none')) { e.preventDefault(); this.focuspaste() } },
    
    initroute: function () {
        if (upload.pendingMemoData) {
            const memo = upload.pendingMemoData;
            delete upload.pendingMemoData;
            console.log('[home] Editing memo:', memo.name);
            this._.uploadview.addClass('d-none');
            this._.newpaste.closest('.topbar').addClass('d-none');
            upload.textpaste.render(this._.view, memo.name, memo.data, memo.mime, this.closepaste.bind(this));
        } else {
            this.focuspaste(); 
        }
    },
    doupload: function (blob) {
        this._.uploadblob = blob;
        this.state = {};
        this._.uploadview.addClass('d-none');
        this._.expiryValue.val('24');
        this._.expiryUnit.val('hours');
        this._.expiryErrorMsg.text('');
        this._.expiryModal.show();
    },
    selectExpiry: function() {
        const value = parseInt(this._.expiryValue.val(), 10);
        const unit = this._.expiryUnit.val();
        if (isNaN(value) || value < 1) {
            this._.expiryErrorMsg.text("Please enter a positive number.");
            this.shakeModal(this._.expiryCard);
            return;
        }
        const durationInHours = (unit === 'days') ? value * 24 : value;
        if (durationInHours > 30 * 24) {
            this._.expiryErrorMsg.text("Maximum duration is 30 days.");
            this.shakeModal(this._.expiryCard);
            return;
        }
        this.state.duration = durationInHours;
        $(this._.expiryModal._element).one('hidden.bs.modal', () => {
            this._.passwordfield.val('');
            this._.uploadErrorMsg.text('');
            this._.passwordmodal.show();
        });
        this._.expiryModal.hide();
    },
    backToExpiry: function() {
        $(this._.passwordmodal._element).one('hidden.bs.modal', () => this._.expiryModal.show());
        this._.passwordmodal.hide();
    },
    cancelUpload: function() {
        const onHide = () => {
            this._.uploadblob = null;
            this._.uploadview.removeClass('d-none');
        };
        const activeModal = [this._.expiryModal, this._.passwordmodal, this._.twofaChoiceModal, this._.facemodal, this._.totpmodal].find(m => m._isShown);
        if (activeModal) {
            $(activeModal._element).one('hidden.bs.modal', onHide);
            activeModal.hide();
        } else {
            onHide();
        }
    },
    submitpassword: function(e) {
        e.preventDefault();
        const password = this._.passwordfield.val();
        if (!password) {
            this._.uploadErrorMsg.text("Please enter a password.");
            this.shakeModal(this._.passwordCard);
            return;
        }
        this.state.password = password;
        $(this._.passwordmodal._element).one('hidden.bs.modal', () => this._.twofaChoiceModal.show());
        this._.passwordmodal.hide();
    },
    chooseFace: function() {
        $(this._.twofaChoiceModal._element).one('hidden.bs.modal', () => this.startFaceModal());
        this._.twofaChoiceModal.hide();
    },
    chooseTOTP: function() {
        $(this._.twofaChoiceModal._element).one('hidden.bs.modal', () => this.startTOTPModal());
        this._.twofaChoiceModal.hide();
    },
    skip2FA: function() {
        const btn = $('#skip_2fa_btn');
        btn.html('<div class="spinner-border spinner-border-sm me-2" role="status"></div>Starting...').prop('disabled', true);
        
        // Wait for modal transition then start
        $(this._.twofaChoiceModal._element).one('hidden.bs.modal', () => this.startUpload(null));
        this._.twofaChoiceModal.hide();
    },
    backFrom2FA: function() {
        const active2FAModal = this._.facemodal._isShown ? this._.facemodal : (this._.totpmodal._isShown ? this._.totpmodal : null);
        if (active2FAModal) {
            if (active2FAModal === this._.facemodal && this.webcam) {
                this.webcam.stop();
                this.webcam = null;
            }
            $(active2FAModal._element).one('hidden.bs.modal', () => this._.twofaChoiceModal.show());
            active2FAModal.hide();
        }
    },
    startFaceModal: function() {
        this._.facemodal.show();
        const videoElement = document.getElementById('face_webcam');
        const canvasElement = document.getElementById('face_canvas');
        const errorMsg = this._.faceErrorMsg;

        errorMsg.text('');
        
        this.webcam = new Webcam(videoElement, 'user', canvasElement);

        videoElement.addEventListener('loadedmetadata', () => {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }, { once: true });

        this.webcam.start({ width: { ideal: 4096 }, height: { ideal: 2160 } })
            .catch(err => errorMsg.text("Could not start webcam. Please allow camera access."));
    },
    captureFace: function() {
        const videoElement = document.getElementById('face_webcam');
        const canvasElement = document.getElementById('face_canvas');
        const btn = $('#capture_face_btn'); 
        
        if (!this.webcam || videoElement.readyState < 2) {
            this._.faceErrorMsg.text("Webcam is not ready. Please wait.");
            this.shakeModal(this._.faceCard);
            return;
        }

        const originalBtnText = btn.html();
        btn.html('<div class="spinner-border spinner-border-sm me-2" role="status"></div>Processing...').prop('disabled', true);
        this._.faceErrorMsg.text(''); 

        const context = canvasElement.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        const faceDataUri = canvasElement.toDataURL('image/png');
        
        if (!faceDataUri || faceDataUri.length < 100) {
            this._.faceErrorMsg.text("Failed to capture image. Please try again.");
            this.shakeModal(this._.faceCard);
            btn.html(originalBtnText).prop('disabled', false); 
            return;
        }

        this._.faceErrorMsg.text('Verifying face with server...');
        console.log(`[Client-DEBUG] 1. Sending Face Snapshot to DeepFace for Liveness Check...`);

        $.ajax({
            type: 'POST',
            url: '/verify_face_setup',
            data: JSON.stringify({ faceDataUri: faceDataUri }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
        }).done(response => {
            if (response.valid) {
                console.log(`[Client-DEBUG] 2. Liveness Check PASSED. Preparing for Encryption.`);
                this._.faceErrorMsg.text('Face accepted. Fetching Encryption Key...');
                
                // --- KEY EXCHANGE LOGGING ---
                console.log(`[Client-DEBUG] 3. Requesting Server's ECC Public Key (GET /public_key)...`);
                
                $.get('/public_key')
                    .done(keyData => {
                        console.log(`[Client-DEBUG] 4. Public Key Received: ${keyData.key.substring(0, 20)}...`);
                        console.log(`[Client-DEBUG] 5. Encrypting Face Data on Client-Side using Server Key...`);
                        
                        crypt.encryptFace(keyData.key, faceDataUri)
                            .done(result => {
                                console.log(`[Client-DEBUG] 6. Face Data Encrypted. Starting Upload Process.`);
                                this.startUpload({ type: 'face', data: result.encryptedFace });
                            })
                            .fail(() => {
                                this._.faceErrorMsg.text("A crypto error occurred.");
                                btn.html(originalBtnText).prop('disabled', false); 
                            });
                    })
                    .fail(() => {
                        this._.faceErrorMsg.text("Error: Could not contact server for encryption key.");
                        btn.html(originalBtnText).prop('disabled', false); 
                    });
            } else {
                console.warn(`[Client-DEBUG] Liveness Check FAILED: ${response.error}`);
                this._.faceErrorMsg.text(response.error || "Face could not be validated.");
                this.shakeModal(this._.faceCard);
                btn.html(originalBtnText).prop('disabled', false); 
            }
        }).fail(jqXHR => {
            const errorMsg = jqXHR.responseJSON?.error || "An unknown validation error occurred.";
            this._.faceErrorMsg.text(errorMsg);
            this.shakeModal(this._.faceCard);
            btn.html(originalBtnText).prop('disabled', false); 
        });
    },
    startTOTPModal: function() {
        this._.totpErrorMsg.text('');
        this._.totpVerifyInput.val('');
        this._.totpmodal.show();
        $.get('/generate_totp')
            .done(response => {
                this.state.totpSecret = response.secret;
                this._.totpSecretDisplay.val(response.secret);
                this._.totpQRContainer.html('').append($('<img>', { src: response.qrCode }));
            })
            .fail(() => this._.totpErrorMsg.text("Error: Could not generate TOTP secret."));
    },
    formatTOTPInput: function(e) { e.target.value = e.target.value.replace(/\D/g, ''); },
    verifyTOTP: function() {
        const code = this._.totpVerifyInput.val();
        const btn = $('#verify_totp_btn'); 

        if (code.length !== 6) {
            this._.totpErrorMsg.text("Please enter a 6-digit code.");
            this.shakeModal(this._.totpCard);
            return;
        }

        const originalBtnText = btn.html();
        btn.html('<div class="spinner-border spinner-border-sm me-2" role="status"></div>Verifying...').prop('disabled', true);
        
        this._.totpErrorMsg.text('Verifying...');
        console.log(`[Client-DEBUG] 1. Verifying TOTP Code (${code}) with temporary secret...`);
        
         $.ajax({
            type: 'POST',
            url: '/verify_totp_setup',
            data: JSON.stringify({ secret: this.state.totpSecret, token: code }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: response => {
                if (response.valid) {
                    console.log(`[Client-DEBUG] 2. TOTP Valid. Fetching Encryption Key...`);
                    
                    // --- KEY EXCHANGE LOGGING ---
                    console.log(`[Client-DEBUG] 3. Requesting Server's ECC Public Key (GET /public_key)...`);
                    
                    $.get('/public_key')
                        .done(keyData => {
                            console.log(`[Client-DEBUG] 4. Public Key Received: ${keyData.key.substring(0, 20)}...`);
                            console.log(`[Client-DEBUG] 5. Encrypting TOTP Secret on Client-Side using Server Key...`);
                            
                            crypt.encryptTOTP(keyData.key, this.state.totpSecret)
                                .done(result => {
                                    console.log(`[Client-DEBUG] 6. Secret Encrypted. Starting Upload Process.`);
                                    this.startUpload({ type: 'totp', data: result.encryptedTOTP });
                                })
                                .fail(() => {
                                    this._.totpErrorMsg.text("A crypto error occurred.");
                                    btn.html(originalBtnText).prop('disabled', false);
                                });
                        })
                        .fail(() => {
                            this._.totpErrorMsg.text("Error: Could not contact server.");
                            btn.html(originalBtnText).prop('disabled', false);
                        });
                } else {
                    console.warn(`[Client-DEBUG] TOTP Verification Failed.`);
                    this._.totpErrorMsg.text("Invalid code. Please try again.");
                    this.shakeModal(this._.totpCard);
                    btn.html(originalBtnText).prop('disabled', false);
                }
            },
            error: () => {
                this._.totpErrorMsg.text("Verification failed. Please try again.");
                this.shakeModal(this._.totpCard);
                btn.html(originalBtnText).prop('disabled', false);
            }
        });
    },
    startUpload: function(twoFAData) {
        if (this.webcam) this.webcam.stop();
        
        const activeModal = [this._.facemodal, this._.totpmodal, this._.twofaChoiceModal].find(m => m._isShown);
        
        const showProgress = () => {
            // 1. FIX: Make the main container visible again (it was hidden in doupload)
            this._.uploadview.removeClass('d-none');
            
            // 2. Hide the drag-and-drop box (pastearea)
            this._.pastearea.addClass('d-none');

            // 3. Show the progress box
            this._.progress.main.removeClass('d-none');
            
            // Reset Progress UI
            this._.progress.bg.css('width', '0%');
            this._.progress.amount.text('0%');
            this._.progress.type.text('Initializing Encryption...');
            
            // Hide the top bar (New Paste button)
            this._.newpaste.closest('.topbar').addClass('d-none');
            
            // Start the actual upload/encryption
            upload.updown.upload(this._.uploadblob, this.progress.bind(this), this.uploaded.bind(this), this.state.password, twoFAData);
            this._.uploadblob = null;
        };

        if (activeModal) {
            // Wait for the modal to fully hide before showing the progress bar
            $(activeModal._element).one('hidden.bs.modal', showProgress);
            activeModal.hide();
        } else {
            showProgress();
        }
    },
    progress: function(e) {
        // 1. Handle Error Objects
        if (typeof e === 'object' && e.status === 'error') {
            let userMsg = "Upload Failed";
            if (e.detail === "Invalid array length" || (e.detail && e.detail.includes("Memory"))) {
                userMsg = "Error: File too large (Browser Memory Limit)";
            } else {
                userMsg = "Error: " + (e.detail || "Unknown error");
            }
            
            this._.progress.type.text(userMsg); // No dots for error
            this._.progress.bg.addClass('bg-danger').css('width', '100%');
            this._.progress.amount.text('!');
            this._.newpaste.closest('.topbar').removeClass('d-none');
            return;
        }

        // 2. Handle Legacy Strings
        if (typeof e === 'string') {
            const msg = e === 'error' ? 'Upload Failed' : e;
            this._.progress.type.text(msg);
            if (e === 'error') {
                this._.progress.bg.addClass('bg-danger');
                this._.newpaste.closest('.topbar').removeClass('d-none');
            }
            return;
        }
        
        // 3. Handle Progress & Animated Dots
        let type;
        if (e.eventsource === 'reading') {
            type = 'Reading File';
        } else if (e.eventsource === 'encrypt') {
            type = 'Encrypting Locker';
        } else {
            type = 'Uploading Locker';
        }
        
        // Only update the HTML if the status type has changed (prevents animation reset)
        if (this._.lastType !== type) {
            this._.lastType = type;
            this._.progress.type.html(`${type}<span class="animated-dots"></span>`);
        }
        
        const percent = Math.floor((e.loaded / e.total) * 100);
        
        this._.progress.bg.css('width', `${percent}%`);
        this._.progress.amount.text(`${percent}%`);
    },
    uploaded: function (data, response) {
        const performRedirect = () => {
            localStorage.setItem('delete-' + data.ident, response.delkey);
            this._.progress.type.text('Complete!');
            anime({
                targets: this._.progress.main[0],
                opacity: [1, 0],
                duration: 500,
                delay: 500,
                complete: () => {
                    window.location.hash = '#' + data.seed;
                }
            });
        };
        if (this.state.duration !== undefined) {
            $.post(`/set_expiry/${data.ident}`, { delkey: response.delkey, duration: this.state.duration }).always(performRedirect);
        } else {
            performRedirect();
        }
        this.state = {}; 
    },
    closepaste: function() {
        this._.uploadview.removeClass('d-none');
        this._.newpaste.closest('.topbar').removeClass('d-none');
        this.focuspaste();
    },
    dopasteupload: function (data, filename) {
        this._.uploadview.addClass('d-none');
        this._.newpaste.closest('.topbar').addClass('d-none');
        upload.textpaste.render(this._.view, filename || 'Pasted-Memo.txt', data, 'text/plain', this.closepaste.bind(this));
    },
    newpaste: function() { 
        this.dopasteupload('', 'Untitled-Memo.txt');
    },
    pasted: function(e) {
        if (!this._ || this._.pastearea.hasClass('d-none')) return;
        const clipboardData = e.originalEvent.clipboardData;
        const text = clipboardData.getData('text/plain');
        if (text) {
            e.preventDefault();
            this.dopasteupload(text);
        } else {
            const file = Array.from(clipboardData.items).find(item => item.kind === 'file')?.getAsFile();
            if (file) {
                e.preventDefault();
                this.doupload(file);
            }
        }
    },
});